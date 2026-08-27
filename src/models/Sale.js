const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Party',
      required: [true, 'Please select a customer'],
      index: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    customerPhone: {
      type: String,
      default: '',
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        productName: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 0.01,
        },
        unit: {
          type: String,
          default: 'pcs',
        },
        unitPrice: {
          type: Number,
          required: true,
          min: 0,
        },
        total: {
          type: Number,
          required: true,
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    netAmount: {
      type: Number,
      required: true,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    dueAmount: {
      type: Number,
      default: 0,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
    accountName: {
      type: String,
      default: '',
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'partial', 'unpaid'],
      default: 'unpaid',
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

saleSchema.index({ businessId: 1, invoiceNumber: 1 });

module.exports = mongoose.model('Sale', saleSchema);
