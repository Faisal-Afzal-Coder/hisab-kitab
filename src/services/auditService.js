const ActivityLog = require('../models/ActivityLog');

const logActivity = async ({
  businessId,
  user,
  action,
  module,
  entityId = null,
  description,
  amount = null,
  partyName = '',
  accountName = '',
  metadata = {},
}) => {
  try {
    const activity = new ActivityLog({
      businessId,
      userId: user._id || user.id,
      userName: user.name,
      brotherIndex: user.brotherIndex || 1,
      avatarColor: user.avatarColor || '#10b981',
      action,
      module,
      entityId,
      description,
      amount,
      partyName,
      accountName,
      metadata,
    });
    await activity.save();
    return activity;
  } catch (error) {
    console.error('[Audit Log Error]:', error.message);
    // Don't fail parent operation if audit log has an issue
    return null;
  }
};

module.exports = { logActivity };
