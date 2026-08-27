const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    transactionNumber: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'payment_in',     // Customer Payment Received (Wusooli)
        'payment_out',    // Supplier Payment Made (Adaigi)
        'sale',           // Sale (Cash / Credit / Partial)
        'purchase',       // Purchase (Cash / Credit / Partial)
        'expense',        // Business Expense (Kharcha)
        'income',         // Direct Income / Other Receipt
        'transfer',       // Account Transfer (Cash <-> Bank)
        'adjustment',     // Balance adjustment / correction
      ],
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Please provide transaction amount'],
      min: [0.01, 'Amount must be greater than zero'],
    },
    // Explicit Money In / Money Out fields for instant ledger computations & cash flow
    moneyIn: {
      type: Number,
      default: 0,
    },
    moneyOut: {
      type: Number,
      default: 0,
    },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Party',
      default: null,
      index: true,
    },
    partyName: {
      type: String,
      default: '',
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
      index: true,
    },
    accountName: {
      type: String,
      default: '',
    },
    toAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
    toAccountName: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      default: '',
    },
    reference: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    attachmentUrl: {
      type: String,
      default: '',
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
        },
        productName: String,
        quantity: Number,
        unit: String,
        unitPrice: Number,
        total: Number,
      },
    ],
    // Multi-Brother Identity Tracking
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    createdByName: {
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
    isVoid: {
      type: Boolean,
      default: false,
    },
    runningBalance: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

transactionSchema.index({ businessId: 1, date: -1 });
transactionSchema.index({ businessId: 1, partyId: 1, date: -1 });
transactionSchema.index({ businessId: 1, accountId: 1, date: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
