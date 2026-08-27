const Transaction = require('../models/Transaction');
const Party = require('../models/Party');
const Account = require('../models/Account');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Expense = require('../models/Expense');
const { logActivity } = require('./auditService');

// Helper to generate transaction numbers (e.g. TXN-260826-001)
const generateTxnNumber = async (businessId, prefix = 'TXN') => {
  const count = await Transaction.countDocuments({ businessId });
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `${prefix}-${dateStr}-${String(count + 1).padStart(4, '0')}`;
};

/**
 * 1. RECORD CUSTOMER PAYMENT RECEIVED (WUSOOLI / PAYMENT IN)
 * Customer gives money -> Decreases party receivable -> Increases cash/bank account balance
 */
const recordPaymentIn = async ({
  businessId,
  user,
  partyId,
  accountId,
  amount,
  date = new Date(),
  reference = '',
  description = '',
  attachmentUrl = '',
}) => {
  if (!partyId) throw new Error('Customer / Party is required for receiving payment');
  if (!accountId) throw new Error('Destination Account (Cash/Bank) is required');
  if (amount <= 0) throw new Error('Payment amount must be greater than zero');

  const party = await Party.findOne({ _id: partyId, businessId });
  if (!party) throw new Error('Party not found');

  const account = await Account.findOne({ _id: accountId, businessId });
  if (!account) throw new Error('Account not found');

  // Update Account: Money Received increases Cash/Bank balance
  account.currentBalance += Number(amount);
  await account.save();

  // Update Party: Receiving payment decreases what customer owes us (currentBalance decreases)
  party.currentBalance -= Number(amount);
  await party.save();

  const txnNumber = await generateTxnNumber(businessId, 'RCT');

  const transaction = new Transaction({
    businessId,
    transactionNumber: txnNumber,
    date,
    type: 'payment_in',
    amount: Number(amount),
    moneyIn: Number(amount),
    moneyOut: 0,
    partyId: party._id,
    partyName: party.name,
    accountId: account._id,
    accountName: account.name,
    reference,
    description: description || `Payment received from ${party.name}`,
    attachmentUrl,
    createdBy: user._id,
    createdByName: user.name,
    brotherIndex: user.brotherIndex || 1,
    avatarColor: user.avatarColor || '#10b981',
    runningBalance: party.currentBalance,
  });

  await transaction.save();

  // Audit log
  await logActivity({
    businessId,
    user,
    action: 'RECEIVE_PAYMENT',
    module: 'Payment',
    entityId: transaction._id,
    description: `${user.name} received ${party.currency || 'Rs.'} ${Number(amount).toLocaleString()} from ${party.name} into ${account.name}`,
    amount: Number(amount),
    partyName: party.name,
    accountName: account.name,
    metadata: { transactionNumber: txnNumber, partyBalanceAfter: party.currentBalance },
  });

  return { transaction, party, account };
};

/**
 * 2. RECORD SUPPLIER PAYMENT MADE (ADAIGI / PAYMENT OUT)
 * Business pays money -> Decreases supplier payable -> Decreases cash/bank account balance
 */
const recordPaymentOut = async ({
  businessId,
  user,
  partyId,
  accountId,
  amount,
  date = new Date(),
  reference = '',
  description = '',
  attachmentUrl = '',
}) => {
  if (!partyId) throw new Error('Supplier / Party is required for making payment');
  if (!accountId) throw new Error('Source Account (Cash/Bank) is required');
  if (amount <= 0) throw new Error('Payment amount must be greater than zero');

  const party = await Party.findOne({ _id: partyId, businessId });
  if (!party) throw new Error('Party not found');

  const account = await Account.findOne({ _id: accountId, businessId });
  if (!account) throw new Error('Account not found');

  // Update Account: Money Paid decreases Cash/Bank balance
  account.currentBalance -= Number(amount);
  await account.save();

  // Update Party: Paying supplier reduces our liability (currentBalance moves + towards zero or positive)
  party.currentBalance += Number(amount);
  await party.save();

  const txnNumber = await generateTxnNumber(businessId, 'PYM');

  const transaction = new Transaction({
    businessId,
    transactionNumber: txnNumber,
    date,
    type: 'payment_out',
    amount: Number(amount),
    moneyIn: 0,
    moneyOut: Number(amount),
    partyId: party._id,
    partyName: party.name,
    accountId: account._id,
    accountName: account.name,
    reference,
    description: description || `Payment made to ${party.name}`,
    attachmentUrl,
    createdBy: user._id,
    createdByName: user.name,
    brotherIndex: user.brotherIndex || 1,
    avatarColor: user.avatarColor || '#10b981',
    runningBalance: party.currentBalance,
  });

  await transaction.save();

  // Audit log
  await logActivity({
    businessId,
    user,
    action: 'MAKE_PAYMENT',
    module: 'Payment',
    entityId: transaction._id,
    description: `${user.name} paid Rs. ${Number(amount).toLocaleString()} to ${party.name} from ${account.name}`,
    amount: Number(amount),
    partyName: party.name,
    accountName: account.name,
    metadata: { transactionNumber: txnNumber, partyBalanceAfter: party.currentBalance },
  });

  return { transaction, party, account };
};

/**
 * 3. RECORD SALE INVOICE
 * Selling products -> Decrements stock -> If credit/partial: increases customer receivable -> If cash/partial: increases account
 */
const recordSale = async ({
  businessId,
  user,
  customerId,
  items,
  discount = 0,
  paidAmount = 0,
  accountId = null,
  date = new Date(),
  notes = '',
  attachmentUrl = '',
}) => {
  if (!customerId) throw new Error('Customer is required for creating a sale invoice');
  if (!items || items.length === 0) throw new Error('At least one item is required');

  const customer = await Party.findOne({ _id: customerId, businessId });
  if (!customer) throw new Error('Customer not found');

  let totalAmount = 0;
  const processedItems = [];

  // Validate and update inventory
  for (const item of items) {
    if (!item.productId) throw new Error('Product ID is missing in item');
    const product = await Product.findOne({ _id: item.productId, businessId });
    if (!product) throw new Error(`Product not found: ${item.productName || item.productId}`);

    const qty = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (qty <= 0) throw new Error(`Quantity for ${product.name} must be greater than zero`);

    // Decrement stock
    product.currentStock -= qty;
    await product.save();

    const itemTotal = qty * unitPrice;
    totalAmount += itemTotal;

    processedItems.push({
      productId: product._id,
      productName: product.name,
      quantity: qty,
      unit: product.unit || 'pcs',
      unitPrice,
      total: itemTotal,
    });
  }

  const netAmount = Math.max(0, totalAmount - Number(discount));
  const paid = Number(paidAmount) || 0;
  const dueAmount = Math.max(0, netAmount - paid);

  let paymentStatus = 'unpaid';
  if (paid >= netAmount) paymentStatus = 'paid';
  else if (paid > 0) paymentStatus = 'partial';

  let account = null;
  if (paid > 0) {
    if (!accountId) throw new Error('Account is required when paid amount is greater than zero');
    account = await Account.findOne({ _id: accountId, businessId });
    if (!account) throw new Error('Selected payment account not found');
    account.currentBalance += paid;
    await account.save();
  }

  // Update customer receivable for unpaid balance
  customer.currentBalance += dueAmount;
  await customer.save();

  const invoiceNumber = await generateTxnNumber(businessId, 'INV');

  // Create Sale Document
  const sale = new Sale({
    businessId,
    invoiceNumber,
    date,
    customerId: customer._id,
    customerName: customer.name,
    customerPhone: customer.phone,
    items: processedItems,
    totalAmount,
    discount: Number(discount),
    netAmount,
    paidAmount: paid,
    dueAmount,
    accountId: account ? account._id : null,
    accountName: account ? account.name : '',
    paymentStatus,
    notes,
    attachmentUrl,
    createdBy: user._id,
    createdByName: user.name,
    brotherIndex: user.brotherIndex || 1,
  });

  // Create Transaction Ledger Entry
  const transaction = new Transaction({
    businessId,
    transactionNumber: invoiceNumber,
    date,
    type: 'sale',
    amount: netAmount,
    moneyIn: paid,
    moneyOut: 0,
    partyId: customer._id,
    partyName: customer.name,
    accountId: account ? account._id : null,
    accountName: account ? account.name : '',
    reference: invoiceNumber,
    description: `Sale Invoice #${invoiceNumber} to ${customer.name} (Total: Rs. ${netAmount.toLocaleString()}, Paid: Rs. ${paid.toLocaleString()}, Due: Rs. ${dueAmount.toLocaleString()})`,
    items: processedItems,
    attachmentUrl,
    createdBy: user._id,
    createdByName: user.name,
    brotherIndex: user.brotherIndex || 1,
    avatarColor: user.avatarColor || '#10b981',
    runningBalance: customer.currentBalance,
  });

  await transaction.save();
  sale.transactionId = transaction._id;
  await sale.save();

  // Audit log
  await logActivity({
    businessId,
    user,
    action: 'CREATE',
    module: 'Sale',
    entityId: sale._id,
    description: `${user.name} generated Sale Invoice #${invoiceNumber} for ${customer.name} worth Rs. ${netAmount.toLocaleString()} (Paid: Rs. ${paid.toLocaleString()}, Due: Rs. ${dueAmount.toLocaleString()})`,
    amount: netAmount,
    partyName: customer.name,
    accountName: account ? account.name : '',
    metadata: { invoiceNumber, dueAmount, paidAmount: paid },
  });

  return { sale, transaction, customer, account };
};

/**
 * 4. RECORD PURCHASE INVOICE
 * Purchasing products -> Increments stock -> If credit/partial: increases supplier payable -> If cash/partial: decreases account
 */
const recordPurchase = async ({
  businessId,
  user,
  supplierId,
  items,
  discount = 0,
  paidAmount = 0,
  accountId = null,
  date = new Date(),
  notes = '',
  attachmentUrl = '',
}) => {
  if (!supplierId) throw new Error('Supplier is required for creating a purchase');
  if (!items || items.length === 0) throw new Error('At least one item is required');

  const supplier = await Party.findOne({ _id: supplierId, businessId });
  if (!supplier) throw new Error('Supplier not found');

  let totalAmount = 0;
  const processedItems = [];

  // Validate and update inventory
  for (const item of items) {
    if (!item.productId) throw new Error('Product ID is missing in item');
    const product = await Product.findOne({ _id: item.productId, businessId });
    if (!product) throw new Error(`Product not found: ${item.productName || item.productId}`);

    const qty = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (qty <= 0) throw new Error(`Quantity for ${product.name} must be greater than zero`);

    // Increment stock
    product.currentStock += qty;
    // Optionally update purchase price to latest
    if (unitPrice > 0) product.purchasePrice = unitPrice;
    await product.save();

    const itemTotal = qty * unitPrice;
    totalAmount += itemTotal;

    processedItems.push({
      productId: product._id,
      productName: product.name,
      quantity: qty,
      unit: product.unit || 'pcs',
      unitPrice,
      total: itemTotal,
    });
  }

  const netAmount = Math.max(0, totalAmount - Number(discount));
  const paid = Number(paidAmount) || 0;
  const dueAmount = Math.max(0, netAmount - paid);

  let paymentStatus = 'unpaid';
  if (paid >= netAmount) paymentStatus = 'paid';
  else if (paid > 0) paymentStatus = 'partial';

  let account = null;
  if (paid > 0) {
    if (!accountId) throw new Error('Account is required when paid amount is greater than zero');
    account = await Account.findOne({ _id: accountId, businessId });
    if (!account) throw new Error('Selected payment account not found');
    account.currentBalance -= paid;
    await account.save();
  }

  // Update supplier payable for unpaid balance (reduces balance in negative direction)
  supplier.currentBalance -= dueAmount;
  await supplier.save();

  const invoiceNumber = await generateTxnNumber(businessId, 'PUR');

  // Create Purchase Document
  const purchase = new Purchase({
    businessId,
    invoiceNumber,
    date,
    supplierId: supplier._id,
    supplierName: supplier.name,
    items: processedItems,
    totalAmount,
    discount: Number(discount),
    netAmount,
    paidAmount: paid,
    dueAmount,
    accountId: account ? account._id : null,
    accountName: account ? account.name : '',
    paymentStatus,
    notes,
    attachmentUrl,
    createdBy: user._id,
    createdByName: user.name,
    brotherIndex: user.brotherIndex || 1,
  });

  // Create Transaction Ledger Entry
  const transaction = new Transaction({
    businessId,
    transactionNumber: invoiceNumber,
    date,
    type: 'purchase',
    amount: netAmount,
    moneyIn: 0,
    moneyOut: paid,
    partyId: supplier._id,
    partyName: supplier.name,
    accountId: account ? account._id : null,
    accountName: account ? account.name : '',
    reference: invoiceNumber,
    description: `Purchase Invoice #${invoiceNumber} from ${supplier.name} (Total: Rs. ${netAmount.toLocaleString()}, Paid: Rs. ${paid.toLocaleString()}, Due: Rs. ${dueAmount.toLocaleString()})`,
    items: processedItems,
    attachmentUrl,
    createdBy: user._id,
    createdByName: user.name,
    brotherIndex: user.brotherIndex || 1,
    avatarColor: user.avatarColor || '#10b981',
    runningBalance: supplier.currentBalance,
  });

  await transaction.save();
  purchase.transactionId = transaction._id;
  await purchase.save();

  // Audit log
  await logActivity({
    businessId,
    user,
    action: 'CREATE',
    module: 'Purchase',
    entityId: purchase._id,
    description: `${user.name} recorded Purchase Invoice #${invoiceNumber} from ${supplier.name} worth Rs. ${netAmount.toLocaleString()} (Paid: Rs. ${paid.toLocaleString()}, Due: Rs. ${dueAmount.toLocaleString()})`,
    amount: netAmount,
    partyName: supplier.name,
    accountName: account ? account.name : '',
    metadata: { invoiceNumber, dueAmount, paidAmount: paid },
  });

  return { purchase, transaction, supplier, account };
};

/**
 * 5. RECORD EXPENSE (KHARCHA)
 */
const recordExpense = async ({
  businessId,
  user,
  title,
  category,
  amount,
  accountId,
  date = new Date(),
  notes = '',
  attachmentUrl = '',
}) => {
  if (!title) throw new Error('Expense title is required');
  if (!accountId) throw new Error('Payment account is required');
  if (amount <= 0) throw new Error('Expense amount must be greater than zero');

  const account = await Account.findOne({ _id: accountId, businessId });
  if (!account) throw new Error('Account not found');

  account.currentBalance -= Number(amount);
  await account.save();

  const txnNumber = await generateTxnNumber(businessId, 'EXP');

  const expense = new Expense({
    businessId,
    title,
    category: category || 'General',
    amount: Number(amount),
    date,
    accountId: account._id,
    accountName: account.name,
    notes,
    attachmentUrl,
    createdBy: user._id,
    createdByName: user.name,
    brotherIndex: user.brotherIndex || 1,
  });

  const transaction = new Transaction({
    businessId,
    transactionNumber: txnNumber,
    date,
    type: 'expense',
    amount: Number(amount),
    moneyIn: 0,
    moneyOut: Number(amount),
    accountId: account._id,
    accountName: account.name,
    category: category || 'General',
    reference: txnNumber,
    description: `Expense: ${title} (${category || 'General'})`,
    attachmentUrl,
    createdBy: user._id,
    createdByName: user.name,
    brotherIndex: user.brotherIndex || 1,
    avatarColor: user.avatarColor || '#10b981',
  });

  await transaction.save();
  expense.transactionId = transaction._id;
  await expense.save();

  await logActivity({
    businessId,
    user,
    action: 'CREATE',
    module: 'Expense',
    entityId: expense._id,
    description: `${user.name} recorded Expense '${title}' worth Rs. ${Number(amount).toLocaleString()} from ${account.name}`,
    amount: Number(amount),
    accountName: account.name,
    metadata: { category, title },
  });

  return { expense, transaction, account };
};

/**
 * 6. RECORD DIRECT INCOME
 */
const recordIncome = async ({
  businessId,
  user,
  title,
  category = 'Direct Income',
  amount,
  accountId,
  partyId = null,
  date = new Date(),
  notes = '',
  attachmentUrl = '',
}) => {
  if (!title) throw new Error('Income title / description is required');
  if (!accountId) throw new Error('Receiving account is required');
  if (amount <= 0) throw new Error('Income amount must be greater than zero');

  const account = await Account.findOne({ _id: accountId, businessId });
  if (!account) throw new Error('Account not found');

  account.currentBalance += Number(amount);
  await account.save();

  let party = null;
  if (partyId) {
    party = await Party.findOne({ _id: partyId, businessId });
  }

  const txnNumber = await generateTxnNumber(businessId, 'INC');

  const transaction = new Transaction({
    businessId,
    transactionNumber: txnNumber,
    date,
    type: 'income',
    amount: Number(amount),
    moneyIn: Number(amount),
    moneyOut: 0,
    partyId: party ? party._id : null,
    partyName: party ? party.name : '',
    accountId: account._id,
    accountName: account.name,
    category,
    reference: txnNumber,
    description: `Income: ${title}`,
    attachmentUrl,
    createdBy: user._id,
    createdByName: user.name,
    brotherIndex: user.brotherIndex || 1,
    avatarColor: user.avatarColor || '#10b981',
  });

  await transaction.save();

  await logActivity({
    businessId,
    user,
    action: 'CREATE',
    module: 'Transaction',
    entityId: transaction._id,
    description: `${user.name} recorded Income '${title}' worth Rs. ${Number(amount).toLocaleString()} into ${account.name}`,
    amount: Number(amount),
    accountName: account.name,
    partyName: party ? party.name : '',
  });

  return { transaction, account };
};

/**
 * 7. RECORD ACCOUNT TRANSFER (CASH <-> BANK OR BANK <-> BANK)
 */
const recordTransfer = async ({
  businessId,
  user,
  fromAccountId,
  toAccountId,
  amount,
  date = new Date(),
  description = '',
}) => {
  if (!fromAccountId || !toAccountId) throw new Error('Both Source and Destination accounts are required');
  if (fromAccountId.toString() === toAccountId.toString()) throw new Error('Source and Destination accounts must be different');
  if (amount <= 0) throw new Error('Transfer amount must be greater than zero');

  const fromAccount = await Account.findOne({ _id: fromAccountId, businessId });
  const toAccount = await Account.findOne({ _id: toAccountId, businessId });

  if (!fromAccount || !toAccount) throw new Error('One or both accounts not found');

  fromAccount.currentBalance -= Number(amount);
  toAccount.currentBalance += Number(amount);

  await fromAccount.save();
  await toAccount.save();

  const txnNumber = await generateTxnNumber(businessId, 'TRF');

  const transaction = new Transaction({
    businessId,
    transactionNumber: txnNumber,
    date,
    type: 'transfer',
    amount: Number(amount),
    moneyIn: 0,
    moneyOut: 0,
    accountId: fromAccount._id,
    accountName: fromAccount.name,
    toAccountId: toAccount._id,
    toAccountName: toAccount.name,
    reference: txnNumber,
    description: description || `Transfer from ${fromAccount.name} to ${toAccount.name}`,
    createdBy: user._id,
    createdByName: user.name,
    brotherIndex: user.brotherIndex || 1,
    avatarColor: user.avatarColor || '#10b981',
  });

  await transaction.save();

  await logActivity({
    businessId,
    user,
    action: 'TRANSFER',
    module: 'Account',
    entityId: transaction._id,
    description: `${user.name} transferred Rs. ${Number(amount).toLocaleString()} from ${fromAccount.name} to ${toAccount.name}`,
    amount: Number(amount),
    accountName: `${fromAccount.name} -> ${toAccount.name}`,
    metadata: { fromAccountId, toAccountId },
  });

  return { transaction, fromAccount, toAccount };
};

/**
 * 8. RECALCULATE & RECONCILE PARTY LEDGER / KHATA STATEMENT
 */
const getPartyStatement = async (businessId, partyId) => {
  const party = await Party.findOne({ _id: partyId, businessId });
  if (!party) throw new Error('Party not found');

  // Fetch all transactions involving this party sorted chronologically
  const transactions = await Transaction.find({
    businessId,
    partyId,
    isVoid: false,
  }).sort({ date: 1, createdAt: 1 });

  let runningBalance = 0;
  if (party.openingBalanceType === 'receivable') {
    runningBalance = Number(party.openingBalance) || 0;
  } else if (party.openingBalanceType === 'payable') {
    runningBalance = -(Number(party.openingBalance) || 0);
  }

  const statementEntries = [];

  // Opening balance row
  statementEntries.push({
    date: party.createdAt,
    transactionNumber: 'OPENING',
    type: 'Opening Balance',
    description: 'Initial Opening Balance',
    debit: party.openingBalanceType === 'receivable' ? party.openingBalance : 0,
    credit: party.openingBalanceType === 'payable' ? party.openingBalance : 0,
    runningBalance,
    createdByName: party.createdByName || 'System',
    brotherIndex: 1,
  });

  for (const txn of transactions) {
    let debit = 0; // Increases Receivable (or decreases payable)
    let credit = 0; // Decreases Receivable (or increases payable)

    if (txn.type === 'sale') {
      // Net sale amount is debited to customer
      debit = txn.amount;
      runningBalance += debit;
      // If immediate cash was paid during sale, record corresponding credit
      if (txn.moneyIn > 0) {
        credit = txn.moneyIn;
        runningBalance -= credit;
      }
    } else if (txn.type === 'payment_in') {
      // Customer payment received -> Credit (reduces what customer owes)
      credit = txn.amount;
      runningBalance -= credit;
    } else if (txn.type === 'purchase') {
      // Purchase from supplier -> Credit to supplier (increases what we owe)
      credit = txn.amount;
      runningBalance -= credit;
      // If immediate cash was paid during purchase, record corresponding debit
      if (txn.moneyOut > 0) {
        debit = txn.moneyOut;
        runningBalance += debit;
      }
    } else if (txn.type === 'payment_out') {
      // Payment made to supplier -> Debit (reduces what we owe)
      debit = txn.amount;
      runningBalance += debit;
    } else if (txn.type === 'adjustment') {
      if (txn.moneyIn > 0) {
        debit = txn.moneyIn;
        runningBalance += debit;
      } else {
        credit = txn.moneyOut;
        runningBalance -= credit;
      }
    }

    statementEntries.push({
      _id: txn._id,
      date: txn.date,
      transactionNumber: txn.transactionNumber,
      type: txn.type,
      description: txn.description,
      accountName: txn.accountName,
      debit,
      credit,
      runningBalance,
      createdByName: txn.createdByName,
      brotherIndex: txn.brotherIndex,
      avatarColor: txn.avatarColor,
    });
  }

  const finalBalance = runningBalance;
  let balanceStatus = 'settled';
  if (finalBalance > 0.01) balanceStatus = 'receivable'; // Lene Hain
  else if (finalBalance < -0.01) balanceStatus = 'payable'; // Dene Hain

  return {
    party,
    openingBalance: party.openingBalance,
    openingBalanceType: party.openingBalanceType,
    statementEntries,
    finalBalance: Math.abs(finalBalance),
    rawFinalBalance: finalBalance,
    balanceStatus,
  };
};

module.exports = {
  recordPaymentIn,
  recordPaymentOut,
  recordSale,
  recordPurchase,
  recordExpense,
  recordIncome,
  recordTransfer,
  getPartyStatement,
  generateTxnNumber,
};
