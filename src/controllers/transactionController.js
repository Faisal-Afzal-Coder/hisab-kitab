const Transaction = require('../models/Transaction');
const Party = require('../models/Party');
const Account = require('../models/Account');
const {
  recordPaymentIn,
  recordPaymentOut,
  recordExpense,
  recordIncome,
  recordTransfer,
} = require('../services/accountingService');
const { logActivity } = require('../services/auditService');

// @desc    Get all ledger transactions with advanced filtering & pagination
// @route   GET /api/transactions
exports.getTransactions = async (req, res, next) => {
  try {
    const {
      startDate,
      endDate,
      brotherId,
      brotherIndex,
      partyId,
      accountId,
      type,
      moneyFlow, // 'in' or 'out'
      search,
      page = 1,
      limit = 25,
      sortBy = 'date',
      sortOrder = 'desc',
    } = req.query;

    const query = { businessId: req.businessId, isVoid: false };

    // Date Range Filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    // Brother / User filter
    if (brotherId) query.createdBy = brotherId;
    if (brotherIndex) query.brotherIndex = Number(brotherIndex);

    // Party filter
    if (partyId) query.partyId = partyId;

    // Account filter
    if (accountId) {
      query.$or = [{ accountId: accountId }, { toAccountId: accountId }];
    }

    // Transaction Type filter
    if (type) {
      query.type = type;
    }

    // Money In / Money Out filter
    if (moneyFlow === 'in') {
      query.moneyIn = { $gt: 0 };
    } else if (moneyFlow === 'out') {
      query.moneyOut = { $gt: 0 };
    }

    // Search query
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const searchConditions = [
        { transactionNumber: searchRegex },
        { partyName: searchRegex },
        { accountName: searchRegex },
        { description: searchRegex },
        { reference: searchRegex },
        { category: searchRegex },
        { createdByName: searchRegex },
      ];

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 25;
    const skip = (pageNum - 1) * limitNum;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    if (sortBy !== '_id') sortOptions._id = -1;

    const [transactions, total, totalsAgg] = await Promise.all([
      Transaction.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .populate('partyId', 'name phone currentBalance')
        .populate('accountId', 'name type currentBalance')
        .populate('toAccountId', 'name type currentBalance')
        .populate('createdBy', 'name email avatarColor brotherIndex'),
      Transaction.countDocuments(query),
      Transaction.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalMoneyIn: { $sum: '$moneyIn' },
            totalMoneyOut: { $sum: '$moneyOut' },
            totalAmount: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    const summary = totalsAgg[0] || { totalMoneyIn: 0, totalMoneyOut: 0, totalAmount: 0 };

    res.status(200).json({
      success: true,
      count: transactions.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      summary: {
        totalMoneyIn: summary.totalMoneyIn,
        totalMoneyOut: summary.totalMoneyOut,
        netFlow: summary.totalMoneyIn - summary.totalMoneyOut,
        totalTransactions: total,
      },
      transactions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single transaction detail
// @route   GET /api/transactions/:id
exports.getTransactionById = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    })
      .populate('partyId')
      .populate('accountId')
      .populate('toAccountId')
      .populate('createdBy', 'name email avatarColor brotherIndex');

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    res.status(200).json({
      success: true,
      transaction,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create Direct Transaction (Income, Expense, Payment In, Payment Out, Transfer)
// @route   POST /api/transactions
exports.createTransaction = async (req, res, next) => {
  try {
    const {
      type,
      partyId,
      accountId,
      toAccountId,
      amount,
      date,
      title,
      category,
      reference,
      description,
      attachmentUrl,
    } = req.body;

    let result;
    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid amount greater than zero' });
    }

    if (type === 'payment_in') {
      result = await recordPaymentIn({
        businessId: req.businessId,
        user: req.user,
        partyId,
        accountId,
        amount: numericAmount,
        date: date || new Date(),
        reference,
        description,
        attachmentUrl,
      });
    } else if (type === 'payment_out') {
      result = await recordPaymentOut({
        businessId: req.businessId,
        user: req.user,
        partyId,
        accountId,
        amount: numericAmount,
        date: date || new Date(),
        reference,
        description,
        attachmentUrl,
      });
    } else if (type === 'expense') {
      result = await recordExpense({
        businessId: req.businessId,
        user: req.user,
        title: title || description || 'Business Expense',
        category,
        amount: numericAmount,
        accountId,
        date: date || new Date(),
        notes: description,
        attachmentUrl,
      });
    } else if (type === 'income') {
      result = await recordIncome({
        businessId: req.businessId,
        user: req.user,
        title: title || description || 'Business Income',
        category,
        amount: numericAmount,
        accountId,
        partyId,
        date: date || new Date(),
        notes: description,
        attachmentUrl,
      });
    } else if (type === 'transfer') {
      result = await recordTransfer({
        businessId: req.businessId,
        user: req.user,
        fromAccountId: accountId,
        toAccountId,
        amount: numericAmount,
        date: date || new Date(),
        description,
      });
    } else {
      return res.status(400).json({ success: false, message: `Unsupported transaction type: ${type}` });
    }

    res.status(201).json({
      success: true,
      message: 'Transaction successfully recorded',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
