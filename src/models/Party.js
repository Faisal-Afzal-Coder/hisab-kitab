const mongoose = require('mongoose');

const partySchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Please provide party name'],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    type: {
      type: String,
      enum: ['customer', 'supplier', 'both', 'partner', 'other'],
      default: 'customer',
      required: true,
    },
    openingBalance: {
      type: Number,
      default: 0,
    },
    openingBalanceType: {
      type: String,
      enum: ['receivable', 'payable', 'none'],
      default: 'none',
    },
    // Calculated balance:
    // Positive balance (> 0) = LENE HAIN (Receivable from Party)
    // Negative balance (< 0) = DENE HAIN (Payable to Party)
    // Zero (0) = Settled (Nill)
    currentBalance: {
      type: Number,
      default: 0,
    },
    address: {
      type: String,
      default: '',
    },
    creditLimit: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdByName: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound index for unique party names per business
partySchema.index({ businessId: 1, name: 1 });

module.exports = mongoose.model('Party', partySchema);
