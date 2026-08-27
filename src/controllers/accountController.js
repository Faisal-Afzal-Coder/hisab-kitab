const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const { recordTransfer } = require('../services/accountingService');
const { logActivity } = require('../services/auditService');

// @desc    Get all accounts with balances
// @route   GET /api/accounts
exports.getAccounts = async (req, res, next) => {
  try {
    const accounts = await Account.find({
      businessId: req.businessId,
      isActive: true,
    }).sort({ isDefault: -1, type: 1, name: 1 });

    let totalCash = 0;
    let totalBank = 0;
    let totalBalance = 0;

    accounts.forEach((acc) => {
      totalBalance += acc.currentBalance;
      if (acc.type === 'cash') totalCash += acc.currentBalance;
      else if (acc.type === 'bank' || acc.type === 'wallet') totalBank += acc.currentBalance;
    });

    res.status(200).json({
      success: true,
      count: accounts.length,
      summary: {
        totalBalance,
        totalCash,
        totalBank,
      },
      accounts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single account statement & transactions
// @route   GET /api/accounts/:id
exports.getAccountById = async (req, res, next) => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    const transactions = await Transaction.find({
      businessId: req.businessId,
      isVoid: false,
      $or: [{ accountId: account._id }, { toAccountId: account._id }],
    })
      .sort({ date: -1, createdAt: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      account,
      transactions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new Account (Cash in Hand, Bank, Mobile Wallet)
// @route   POST /api/accounts
exports.createAccount = async (req, res, next) => {
  try {
    const { name, type, accountNumber, bankName, openingBalance, isDefault } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide account name' });
    }

    const numOpening = Number(openingBalance) || 0;

    const account = new Account({
      businessId: req.businessId,
      name: name.trim(),
      type: type || 'bank',
      accountNumber: accountNumber || '',
      bankName: bankName || '',
      openingBalance: numOpening,
      currentBalance: numOpening,
      isDefault: Boolean(isDefault),
      createdBy: req.user._id,
    });

    await account.save();

    await logActivity({
      businessId: req.businessId,
      user: req.user,
      action: 'CREATE',
      module: 'Account',
      entityId: account._id,
      description: `${req.user.name} created new account '${account.name}' with initial balance Rs. ${numOpening.toLocaleString()}`,
      accountName: account.name,
      amount: numOpening,
    });

    res.status(201).json({
      success: true,
      account,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Transfer funds between accounts
// @route   POST /api/accounts/transfer
exports.transferFunds = async (req, res, next) => {
  try {
    const { fromAccountId, toAccountId, amount, date, description } = req.body;

    const result = await recordTransfer({
      businessId: req.businessId,
      user: req.user,
      fromAccountId,
      toAccountId,
      amount: Number(amount),
      date: date || new Date(),
      description,
    });

    res.status(200).json({
      success: true,
      message: `Successfully transferred Rs. ${Number(amount).toLocaleString()} from ${result.fromAccount.name} to ${result.toAccount.name}`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
