const Expense = require('../models/Expense');
const { recordExpense } = require('../services/accountingService');

// @desc    Get all expenses with category summary
// @route   GET /api/expenses
exports.getExpenses = async (req, res, next) => {
  try {
    const { category, accountId, startDate, endDate, search } = req.query;
    const query = { businessId: req.businessId };

    if (category && category !== 'all') query.category = category;
    if (accountId) query.accountId = accountId;

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

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ title: regex }, { category: regex }, { notes: regex }];
    }

    const expenses = await Expense.find(query)
      .sort({ date: -1, createdAt: -1 })
      .populate('accountId', 'name type')
      .populate('createdBy', 'name avatarColor brotherIndex');

    let totalExpenses = 0;
    const categoryMap = {};

    expenses.forEach((e) => {
      totalExpenses += e.amount;
      categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
    });

    const categoryBreakdown = Object.keys(categoryMap).map((cat) => ({
      category: cat,
      amount: categoryMap[cat],
      percentage: totalExpenses > 0 ? ((categoryMap[cat] / totalExpenses) * 100).toFixed(1) : 0,
    }));

    res.status(200).json({
      success: true,
      count: expenses.length,
      totalExpenses,
      categoryBreakdown,
      expenses,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new expense
// @route   POST /api/expenses
exports.createExpense = async (req, res, next) => {
  try {
    const { title, category, amount, accountId, date, notes, attachmentUrl } = req.body;

    const result = await recordExpense({
      businessId: req.businessId,
      user: req.user,
      title,
      category,
      amount: Number(amount),
      accountId,
      date: date || new Date(),
      notes,
      attachmentUrl,
    });

    res.status(201).json({
      success: true,
      message: 'Expense recorded successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
