const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide expense title'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Please select a category'],
      default: 'General Expense',
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Please provide expense amount'],
      min: [0.01, 'Amount must be positive'],
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'Please select payment account'],
    },
    accountName: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    attachmentUrl: {
      type: String,
      default: '',
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdByName: {
      type: String,
      required: true,
    },
    brotherIndex: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

expenseSchema.index({ businessId: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
