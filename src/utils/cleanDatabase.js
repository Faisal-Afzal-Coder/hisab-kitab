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

dotenv.config({ path: path.join(__dirname, '../../.env') });

const cleanDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hisab_kitab';
    await mongoose.connect(mongoUri);
    console.log('[Clean] Connected to MongoDB at:', mongoUri);

    // 1. Delete all business records (Parties, Products, Transactions, Invoices, Expenses, Logs)
    await Promise.all([
      Party.deleteMany({}),
      Product.deleteMany({}),
      Transaction.deleteMany({}),
      Sale.deleteMany({}),
      Purchase.deleteMany({}),
      Expense.deleteMany({}),
      ActivityLog.deleteMany({}),
      Account.deleteMany({}),
    ]);
    console.log('[Clean] Wiped all transactions, parties, products, and expenses.');

    // 2. Ensure the Business and the 3 Brothers exist with 0 balances
    let business = await Business.findOne();
    if (!business) {
      business = new Business({
        name: 'My Joint Business',
        currency: 'Rs.',
        currencyCode: 'PKR',
      });
      await business.save();
    }

    // Upsert the 3 Brothers
    const brotherConfigs = [
      { name: 'Brother 1', email: 'brother1@business.com', brotherIndex: 1, color: '#10b981', role: 'owner' },
      { name: 'Brother 2', email: 'brother2@business.com', brotherIndex: 2, color: '#3b82f6', role: 'admin' },
      { name: 'Brother 3', email: 'brother3@business.com', brotherIndex: 3, color: '#8b5cf6', role: 'admin' },
    ];

    for (const b of brotherConfigs) {
      let u = await User.findOne({ email: b.email });
      if (!u) {
        u = new User({
          name: b.name,
          email: b.email,
          password: 'password123',
          role: b.role,
          businessId: business._id,
          brotherIndex: b.brotherIndex,
          avatarColor: b.color,
        });
        await u.save();
      } else {
        u.businessId = business._id;
        await u.save();
      }
    }

    // Create single clean 0-balance Cash account
    const brother1 = await User.findOne({ email: 'brother1@business.com' });
    const cashAcc = new Account({
      businessId: business._id,
      name: 'Cash in Hand (Naqd)',
      type: 'cash',
      openingBalance: 0,
      currentBalance: 0,
      isDefault: true,
      createdBy: brother1 ? brother1._id : null,
    });
    await cashAcc.save();

    console.log('[Clean] Database is now 100% clean and ready for real data entry!');
    process.exit(0);
  } catch (error) {
    console.error('[Clean Error]:', error);
    process.exit(1);
  }
};

cleanDatabase();
