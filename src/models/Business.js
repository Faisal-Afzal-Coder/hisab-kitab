const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide business name'],
      trim: true,
      default: 'Joint Brothers Business',
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    members: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        role: {
          type: String,
          enum: ['owner', 'admin', 'member'],
          default: 'admin',
        },
        title: String, // e.g. "Managing Partner (Brother 1)"
      },
    ],
    currency: {
      type: String,
      default: 'Rs.',
    },
    currencyCode: {
      type: String,
      default: 'PKR',
    },
    phone: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      default: '',
    },
    taxNumber: {
      type: String,
      default: '',
    },
    fiscalYearStart: {
      type: String,
      default: '07-01', // July 1st default
    },
    settings: {
      allowNegativeStock: {
        type: Boolean,
        default: false,
      },
      lowStockThreshold: {
        type: Number,
        default: 10,
      },
      receiptFooterMessage: {
        type: String,
        default: 'Thank you for your business!',
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Business', businessSchema);
