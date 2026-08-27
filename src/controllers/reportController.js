const Transaction = require('../models/Transaction');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Expense = require('../models/Expense');
const Party = require('../models/Party');
const Product = require('../models/Product');
const Account = require('../models/Account');

// @desc    Profit & Loss Statement (P&L)
// @route   GET /api/reports/profit-and-loss
exports.getProfitAndLoss = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const dateQuery = {};

    if (startDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      dateQuery.$gte = s;
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      dateQuery.$lte = e;
    }

    const matchQuery = { businessId: req.businessId };
    if (startDate || endDate) {
      matchQuery.date = dateQuery;
    }

    // Revenue from Sales
    const sales = await Sale.find(matchQuery);
    let totalSalesRevenue = 0;
    let costOfGoodsSold = 0;

    sales.forEach((sale) => {
      totalSalesRevenue += sale.netAmount;
    });

    // Purchases
    const purchases = await Purchase.find(matchQuery);
    let totalPurchases = 0;
    purchases.forEach((p) => {
      totalPurchases += p.netAmount;
    });

    // Expenses categorized
    const expenses = await Expense.find(matchQuery);
    let totalExpenses = 0;
    const expenseCategories = {};

    expenses.forEach((e) => {
      totalExpenses += e.amount;
      expenseCategories[e.category] = (expenseCategories[e.category] || 0) + e.amount;
    });

    // Direct other income
    const incomes = await Transaction.find({
      ...matchQuery,
      type: 'income',
      isVoid: false,
    });
    let totalDirectIncome = 0;
    incomes.forEach((inc) => {
      totalDirectIncome += inc.amount;
    });

    const grossProfit = totalSalesRevenue - totalPurchases;
    const netProfit = grossProfit + totalDirectIncome - totalExpenses;

    res.status(200).json({
      success: true,
      report: {
        totalSalesRevenue,
        totalPurchases,
        grossProfit,
        totalDirectIncome,
        totalExpenses,
        expenseCategories,
        netProfit,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Daybook (Roznamcha) for single date
// @route   GET /api/reports/daybook
exports.getDaybook = async (req, res, next) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    const transactions = await Transaction.find({
      businessId: req.businessId,
      date: { $gte: start, $lte: end },
      isVoid: false,
    })
      .sort({ date: 1, createdAt: 1 })
      .populate('createdBy', 'name avatarColor brotherIndex');

    let totalMoneyIn = 0;
    let totalMoneyOut = 0;

    transactions.forEach((t) => {
      totalMoneyIn += t.moneyIn;
      totalMoneyOut += t.moneyOut;
    });

    res.status(200).json({
      success: true,
      date: targetDate,
      count: transactions.length,
      totalMoneyIn,
      totalMoneyOut,
      netDayBalance: totalMoneyIn - totalMoneyOut,
      transactions,
    });
  } catch (error) {
    next(error);
  }
};
