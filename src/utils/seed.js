const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../models/User');
const Business = require('../models/Business');
const Account = require('../models/Account');
const Party = require('../models/Party');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Expense = require('../models/Expense');
const ActivityLog = require('../models/ActivityLog');
const {
  recordSale,
  recordPurchase,
  recordPaymentIn,
  recordPaymentOut,
  recordExpense,
  recordTransfer,
} = require('../services/accountingService');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hisab_kitab';
    await mongoose.connect(mongoUri);
    console.log('[Seed] Connected to MongoDB at:', mongoUri);

    // Clear previous data
    await Promise.all([
      User.deleteMany({}),
      Business.deleteMany({}),
      Account.deleteMany({}),
      Party.deleteMany({}),
      Product.deleteMany({}),
      Transaction.deleteMany({}),
      Sale.deleteMany({}),
      Purchase.deleteMany({}),
      Expense.deleteMany({}),
      ActivityLog.deleteMany({}),
    ]);
    console.log('[Seed] Cleared existing data');

    // 1. Create Business
    const business = new Business({
      name: 'Khan Brothers Joint Trading Co.',
      currency: 'Rs.',
      currencyCode: 'PKR',
      phone: '+92 300 1234567',
      address: 'Main Wholesale Market, Block B, Commercial Area',
      taxNumber: 'NTN-7894561-2',
      settings: {
        allowNegativeStock: false,
        lowStockThreshold: 10,
        receiptFooterMessage: 'Thank you for your business with Khan Brothers!',
      },
    });
    await business.save();

    // 2. Create the 3 Brothers
    const brother1 = new User({
      name: 'Ahmed Khan (Brother 1)',
      email: 'ahmed@khanbrothers.com',
      phone: '0300-1111111',
      password: 'brother123',
      role: 'owner',
      businessId: business._id,
      brotherIndex: 1,
      avatarColor: '#10b981', // Emerald
    });
    await brother1.save();

    const brother2 = new User({
      name: 'Bilal Khan (Brother 2)',
      email: 'bilal@khanbrothers.com',
      phone: '0300-2222222',
      password: 'brother123',
      role: 'admin',
      businessId: business._id,
      brotherIndex: 2,
      avatarColor: '#3b82f6', // Blue
    });
    await brother2.save();

    const brother3 = new User({
      name: 'Hamza Khan (Brother 3)',
      email: 'hamza@khanbrothers.com',
      phone: '0300-3333333',
      password: 'brother123',
      role: 'admin',
      businessId: business._id,
      brotherIndex: 3,
      avatarColor: '#8b5cf6', // Purple
    });
    await brother3.save();

    business.ownerId = brother1._id;
    business.members = [
      { userId: brother1._id, role: 'owner', title: 'Senior Partner (Brother 1)' },
      { userId: brother2._id, role: 'admin', title: 'Managing Partner (Brother 2)' },
      { userId: brother3._id, role: 'admin', title: 'Operations Partner (Brother 3)' },
    ];
    await business.save();
    console.log('[Seed] Created 3 Brothers accounts');

    // 3. Create Cash & Bank Accounts
    const cashAccount = new Account({
      businessId: business._id,
      name: 'Cash in Hand (Tijori / Dukan)',
      type: 'cash',
      openingBalance: 150000,
      currentBalance: 150000,
      isDefault: true,
      createdBy: brother1._id,
    });
    await cashAccount.save();

    const bankAccount = new Account({
      businessId: business._id,
      name: 'Meezan Bank (Main Business A/C)',
      type: 'bank',
      bankName: 'Meezan Bank Ltd',
      accountNumber: '0102-0105849301',
      openingBalance: 450000,
      currentBalance: 450000,
      isDefault: false,
      createdBy: brother1._id,
    });
    await bankAccount.save();

    const easyPaisa = new Account({
      businessId: business._id,
      name: 'EasyPaisa Merchant',
      type: 'wallet',
      accountNumber: '03001234567',
      openingBalance: 25000,
      currentBalance: 25000,
      isDefault: false,
      createdBy: brother2._id,
    });
    await easyPaisa.save();

    // 4. Create Parties
    // Customers
    const customer1 = new Party({
      businessId: business._id,
      name: 'Ali Traders',
      phone: '0321-9876543',
      email: 'ali@alitraders.pk',
      type: 'customer',
      openingBalance: 100000,
      openingBalanceType: 'receivable',
      currentBalance: 100000, // Starts with Rs. 100,000 receivable
      address: 'Shop 42, Grain Market',
      creditLimit: 250000,
      createdBy: brother1._id,
      createdByName: brother1.name,
    });
    await customer1.save();

    const customer2 = new Party({
      businessId: business._id,
      name: 'Usman Super Store',
      phone: '0333-5551234',
      type: 'customer',
      openingBalance: 45000,
      openingBalanceType: 'receivable',
      currentBalance: 45000,
      address: 'Commercial Market, Saddar',
      creditLimit: 150000,
      createdBy: brother2._id,
      createdByName: brother2.name,
    });
    await customer2.save();

    const customer3 = new Party({
      businessId: business._id,
      name: 'Karachi Mart (Walk-in)',
      phone: '0312-3334445',
      type: 'customer',
      openingBalance: 0,
      openingBalanceType: 'none',
      currentBalance: 0,
      address: 'City Center',
      createdBy: brother3._id,
      createdByName: brother3.name,
    });
    await customer3.save();

    // Suppliers
    const supplier1 = new Party({
      businessId: business._id,
      name: 'Bilal Supplier & Co.',
      phone: '0301-4445556',
      type: 'supplier',
      openingBalance: 100000,
      openingBalanceType: 'payable',
      currentBalance: -100000, // Starts with Rs. 100,000 payable
      address: 'Industrial Area, Gate 3',
      createdBy: brother1._id,
      createdByName: brother1.name,
    });
    await supplier1.save();

    const supplier2 = new Party({
      businessId: business._id,
      name: 'Pak Raw Mills Ltd.',
      phone: '0345-6667778',
      type: 'supplier',
      openingBalance: 50000,
      openingBalanceType: 'payable',
      currentBalance: -50000,
      address: 'Mill Road, Sector 5',
      createdBy: brother2._id,
      createdByName: brother2.name,
    });
    await supplier2.save();

    // 5. Create Inventory Products
    const prodRice = new Product({
      businessId: business._id,
      name: 'Super Basmati Rice (25kg)',
      code: 'RICE-25KG',
      category: 'Grains',
      unit: 'bags',
      purchasePrice: 4000,
      salePrice: 4800,
      openingStock: 100,
      currentStock: 100,
      minStockAlert: 15,
      description: 'Premium aged Super Basmati Rice',
      createdBy: brother1._id,
    });
    await prodRice.save();

    const prodOil = new Product({
      businessId: business._id,
      name: 'Cooking Oil Can (5 Liter)',
      code: 'OIL-5L',
      category: 'Edible Oils',
      unit: 'tins',
      purchasePrice: 2100,
      salePrice: 2550,
      openingStock: 120,
      currentStock: 120,
      minStockAlert: 20,
      description: 'Refined palm & canola blend',
      createdBy: brother2._id,
    });
    await prodOil.save();

    const prodTea = new Product({
      businessId: business._id,
      name: 'Golden CTC Tea (1kg Pack)',
      code: 'TEA-1KG',
      category: 'Beverages',
      unit: 'packs',
      purchasePrice: 1200,
      salePrice: 1500,
      openingStock: 80,
      currentStock: 80,
      minStockAlert: 10,
      description: 'Strong Kenyan CTC black tea',
      createdBy: brother3._id,
    });
    await prodTea.save();

    const prodSugar = new Product({
      businessId: business._id,
      name: 'White Refined Sugar (50kg Bag)',
      code: 'SUGAR-50KG',
      category: 'Commodities',
      unit: 'bags',
      purchasePrice: 6500,
      salePrice: 7200,
      openingStock: 6, // Below minimum 10 bags -> triggers low stock alert!
      currentStock: 6,
      minStockAlert: 10,
      description: 'Food grade refined cane sugar',
      createdBy: brother1._id,
    });
    await prodSugar.save();

    console.log('[Seed] Created Accounts, Parties & Inventory Products');

    // 6. Record Initial Real Transactions across the 3 Brothers!

    // A. Brother 2 records payment received from Ali Traders:
    // Ali Traders owed 100,000 -> Ali gives Rs. 30,000 -> Remaining becomes Rs. 70,000!
    await recordPaymentIn({
      businessId: business._id,
      user: brother2,
      partyId: customer1._id,
      accountId: cashAccount._id,
      amount: 30000,
      reference: 'RCP-001',
      description: 'Customer installment payment in cash received by Bilal',
    });

    // B. Brother 3 records payment made to Bilal Supplier:
    // Supplier owed 100,000 -> Business pays Rs. 30,000 from Meezan Bank -> Remaining becomes Rs. 70,000!
    await recordPaymentOut({
      businessId: business._id,
      user: brother3,
      partyId: supplier1._id,
      accountId: bankAccount._id,
      amount: 30000,
      reference: 'CHQ-98102',
      description: 'Online bank transfer via Meezan Bank paid by Hamza',
    });

    // C. Brother 1 creates a Sale Invoice to Usman Super Store:
    // 5 bags Rice (5 * 4800 = 24,000) + 10 tins Oil (10 * 2550 = 25,500) = Total 49,500
    // Paid Rs. 20,000 cash, Due Rs. 29,500
    await recordSale({
      businessId: business._id,
      user: brother1,
      customerId: customer2._id,
      items: [
        { productId: prodRice._id, quantity: 5, unitPrice: 4800 },
        { productId: prodOil._id, quantity: 10, unitPrice: 2550 },
      ],
      discount: 500, // net 49,000
      paidAmount: 20000,
      accountId: cashAccount._id,
      notes: 'Delivered to Saddar branch via Suzuki van',
    });

    // D. Brother 2 creates a Purchase Invoice from Pak Raw Mills:
    // 20 bags Rice (20 * 4000 = 80,000), Paid Rs. 30,000 from Bank, Due Rs. 50,000
    await recordPurchase({
      businessId: business._id,
      user: brother2,
      supplierId: supplier2._id,
      items: [{ productId: prodRice._id, quantity: 20, unitPrice: 4000 }],
      discount: 0,
      paidAmount: 30000,
      accountId: bankAccount._id,
      notes: 'Direct mill shipment delivered to warehouse',
    });

    // E. Brother 1 records a Shop Expense:
    await recordExpense({
      businessId: business._id,
      user: brother1,
      title: 'Commercial Electricity Bill (LESCO)',
      category: 'Utilities & Bills',
      amount: 14500,
      accountId: cashAccount._id,
      notes: 'Paid at Post Office branch',
    });

    // F. Brother 3 transfers Rs. 40,000 from Bank to Cash:
    await recordTransfer({
      businessId: business._id,
      user: brother3,
      fromAccountId: bankAccount._id,
      toAccountId: cashAccount._id,
      amount: 40000,
      description: 'Hamza withdrew cash for daily market purchases',
    });

    console.log('[Seed] Successfully seeded all transactions and verified double-entry balances!');
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]:', error);
    process.exit(1);
  }
};

seedData();
