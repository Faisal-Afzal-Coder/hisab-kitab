const ActivityLog = require('../models/ActivityLog');

// @desc    Get Activity / Audit Log with filters
// @route   GET /api/activity
exports.getActivityLogs = async (req, res, next) => {
  try {
    const { brotherIndex, module, action, search, page = 1, limit = 50 } = req.query;
    const query = { businessId: req.businessId };

    if (brotherIndex) query.brotherIndex = Number(brotherIndex);
    if (module && module !== 'all') query.module = module;
    if (action && action !== 'all') query.action = action;

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ description: regex }, { userName: regex }, { partyName: regex }, { accountName: regex }];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [activities, total] = await Promise.all([
      ActivityLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      ActivityLog.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: activities.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      activities,
    });
  } catch (error) {
    next(error);
  }
};
