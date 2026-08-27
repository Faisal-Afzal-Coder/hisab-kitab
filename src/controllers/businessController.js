const Business = require('../models/Business');
const User = require('../models/User');
const Party = require('../models/Party');
const Account = require('../models/Account');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Expense = require('../models/Expense');
const ActivityLog = require('../models/ActivityLog');
const { logActivity } = require('../services/auditService');

// @desc    Get Current Business Info
// @route   GET /api/business
exports.getBusiness = async (req, res, next) => {
  try {
    const business = await Business.findById(req.businessId).populate('members.userId', 'name email phone avatarColor brotherIndex');
    res.status(200).json({
      success: true,
      business,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Business Settings & Profile
// @route   PUT /api/business
exports.updateBusiness = async (req, res, next) => {
  try {
    const { name, currency, phone, address, taxNumber, settings } = req.body;
    const business = await Business.findById(req.businessId);

    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    if (name) business.name = name;
    if (currency) business.currency = currency;
    if (phone !== undefined) business.phone = phone;
    if (address !== undefined) business.address = address;
    if (taxNumber !== undefined) business.taxNumber = taxNumber;
    if (settings) business.settings = { ...business.settings, ...settings };

    await business.save();

    await logActivity({
      businessId: req.businessId,
      user: req.user,
      action: 'UPDATE',
      module: 'Business',
      entityId: business._id,
      description: `${req.user.name} updated Business Settings (${business.name})`,
    });

    res.status(200).json({
      success: true,
      business,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear All Business Data (Wipes all transactions, parties, products, and expenses to start fresh)
// @route   POST /api/business/clear-data
exports.clearBusinessData = async (req, res, next) => {
  try {
    const businessId = req.businessId;

    // Delete all records belonging to this business
    await Promise.all([
      Party.deleteMany({ businessId }),
      Product.deleteMany({ businessId }),
      Transaction.deleteMany({ businessId }),
      Sale.deleteMany({ businessId }),
      Purchase.deleteMany({ businessId }),
      Expense.deleteMany({ businessId }),
      ActivityLog.deleteMany({ businessId }),
      Account.deleteMany({ businessId }),
    ]);

    // Recreate a clean default 0-balance Cash account
    const defaultCash = new Account({
      businessId,
      name: 'Cash in Hand (Naqd)',
      type: 'cash',
      openingBalance: 0,
      currentBalance: 0,
      isDefault: true,
      createdBy: req.user._id,
    });
    await defaultCash.save();

    await logActivity({
      businessId,
      user: req.user,
      action: 'DELETE',
      module: 'Business',
      description: `${req.user.name} cleared all business records and reset database to clean state`,
    });

    res.status(200).json({
      success: true,
      message: 'All business records cleared successfully! The system is now completely clean and ready for your real data entry.',
    });
  } catch (error) {
    next(error);
  }
};
