const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
    },
    brotherIndex: {
      type: Number,
      default: 1,
    },
    avatarColor: {
      type: String,
      default: '#10b981',
    },
    action: {
      type: String,
      enum: ['CREATE', 'UPDATE', 'DELETE', 'VOID', 'LOGIN', 'TRANSFER', 'RECEIVE_PAYMENT', 'MAKE_PAYMENT'],
      required: true,
    },
    module: {
      type: String,
      enum: ['Transaction', 'Sale', 'Purchase', 'Party', 'Account', 'Product', 'Expense', 'Payment', 'Business', 'Auth'],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    description: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      default: null,
    },
    partyName: {
      type: String,
      default: '',
    },
    accountName: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

activityLogSchema.index({ businessId: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
