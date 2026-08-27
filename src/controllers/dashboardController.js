const Transaction = require('../models/Transaction');
const Party = require('../models/Party');
const Account = require('../models/Account');
const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Expense = require('../models/Expense');

// @desc    Get complete Dashboard KPIs, Charts, and Multi-Brother Activity Feed
// @route   GET /api/dashboard
exports.getDashboardData = async (req, res, next) => {
  try {
    const { startDate, endDate, datePreset } = req.query;
    const businessId = req.businessId;

    // Determine date boundaries for period metrics
    let start = null;
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    const now = new Date();

    if (datePreset === 'today') {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
    } else if (datePreset === 'yesterday') {
      start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (datePreset === 'thisWeek') {
      start = new Date(now);
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
    } else if (datePreset === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
    } else if (datePreset === 'thisYear') {
      start = new Date(now.getFullYear(), 0, 1);
      start.setHours(0, 0, 0, 0);
    } else if (startDate || endDate) {
      if (startDate) {
        start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
      }
      if (endDate) {
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
      }
    }

    const periodQuery = { businessId, isVoid: false };
    if (start) {
      periodQuery.date = { $gte: start, $lte: end };
    }

    // 1. Overall Balance & Accounts Snapshot (Current as of now)
    const accounts = await Account.find({ businessId, isActive: true });
    let totalCashBalance = 0;
    let totalBankBalance = 0;
    let totalAvailableBalance = 0;

    accounts.forEach((acc) => {
      totalAvailableBalance += acc.currentBalance;
      if (acc.type === 'cash') totalCashBalance += acc.currentBalance;
      else totalBankBalance += acc.currentBalance;
    });

    // 2. Receivables & Payables Snapshot
    const parties = await Party.find({ businessId, isActive: true });
    let totalReceivables = 0;
    let totalPayables = 0;
    let countReceivableParties = 0;
    let countPayableParties = 0;

    parties.forEach((p) => {
      if (p.currentBalance > 0.01) {
        totalReceivables += p.currentBalance;
        countReceivableParties++;
      } else if (p.currentBalance < -0.01) {
        totalPayables += Math.abs(p.currentBalance);
        countPayableParties++;
      }
    });

    // 3. Inventory Stock Valuation
    const products = await Product.find({ businessId, isActive: true });
    let totalInventoryValue = 0;
    let totalInventoryItems = 0;
    let lowStockCount = 0;
    const lowStockItems = [];

    products.forEach((p) => {
      totalInventoryValue += p.currentStock * p.purchasePrice;
      totalInventoryItems += p.currentStock;
      if (p.currentStock <= p.minStockAlert) {
        lowStockCount++;
        lowStockItems.push({
          _id: p._id,
          name: p.name,
          currentStock: p.currentStock,
          minStockAlert: p.minStockAlert,
          unit: p.unit,
        });
      }
    });

    // 4. Period Financial Aggregates
    const [periodTxnsAgg, periodSales, periodPurchases, periodExpenses] = await Promise.all([
      Transaction.aggregate([
        { $match: periodQuery },
        {
          $group: {
            _id: null,
            totalMoneyIn: { $sum: '$moneyIn' },
            totalMoneyOut: { $sum: '$moneyOut' },
            totalVolume: { $sum: '$amount' },
          },
        },
      ]),
      Sale.aggregate([
        { $match: { businessId, ...(start ? { date: { $gte: start, $lte: end } } : {}) } },
        { $group: { _id: null, total: { $sum: '$netAmount' }, paid: { $sum: '$paidAmount' }, count: { $sum: 1 } } },
      ]),
      Purchase.aggregate([
        { $match: { businessId, ...(start ? { date: { $gte: start, $lte: end } } : {}) } },
        { $group: { _id: null, total: { $sum: '$netAmount' }, paid: { $sum: '$paidAmount' }, count: { $sum: 1 } } },
      ]),
      Expense.aggregate([
        { $match: { businessId, ...(start ? { date: { $gte: start, $lte: end } } : {}) } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const periodTxnData = periodTxnsAgg[0] || { totalMoneyIn: 0, totalMoneyOut: 0, totalVolume: 0 };
    const periodSaleData = periodSales[0] || { total: 0, paid: 0, count: 0 };
    const periodPurData = periodPurchases[0] || { total: 0, paid: 0, count: 0 };
    const periodExpData = periodExpenses[0] || { total: 0, count: 0 };

    // 5. Recent Transactions (with brother attribution)
    const recentTransactions = await Transaction.find({ businessId, isVoid: false })
      .sort({ date: -1, createdAt: -1 })
      .limit(8)
      .populate('createdBy', 'name email avatarColor brotherIndex');

    // 6. Recent Brother Activity Log Feed
    const recentActivities = await ActivityLog.find({ businessId })
      .sort({ createdAt: -1 })
      .limit(10);

    // 7. Chart Data: Monthly trend for the past 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyData = await Transaction.aggregate([
      {
        $match: {
          businessId,
          isVoid: false,
          date: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
          },
          moneyIn: { $sum: '$moneyIn' },
          moneyOut: { $sum: '$moneyOut' },
          totalAmount: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const chartMonthly = monthlyData.map((m) => ({
      name: `${monthNames[m._id.month - 1]} ${m._id.year}`,
      moneyIn: m.moneyIn,
      moneyOut: m.moneyOut,
      netFlow: m.moneyIn - m.moneyOut,
    }));

    res.status(200).json({
      success: true,
      kpis: {
        totalAvailableBalance,
        totalCashBalance,
        totalBankBalance,
        totalReceivables,
        totalPayables,
        countReceivableParties,
        countPayableParties,
        totalInventoryValue,
        totalInventoryItems,
        lowStockCount,
        // Period specific metrics:
        periodMoneyReceived: periodTxnData.totalMoneyIn,
        periodMoneyPaid: periodTxnData.totalMoneyOut,
        periodNetCashFlow: periodTxnData.totalMoneyIn - periodTxnData.totalMoneyOut,
        periodSales: periodSaleData.total,
        periodPurchases: periodPurData.total,
        periodExpenses: periodExpData.total,
      },
      accounts,
      recentTransactions,
      recentActivities,
      chartMonthly,
      lowStockItems: lowStockItems.slice(0, 5),
    });
  } catch (error) {
    next(error);
  }
};
