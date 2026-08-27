const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Please provide product name'],
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      default: 'General',
      trim: true,
    },
    unit: {
      type: String,
      default: 'pcs',
      trim: true,
    },
    purchasePrice: {
      type: Number,
      required: [true, 'Please provide purchase price'],
      default: 0,
      min: 0,
    },
    salePrice: {
      type: Number,
      required: [true, 'Please provide sale price'],
      default: 0,
      min: 0,
    },
    currentStock: {
      type: Number,
      default: 0,
    },
    minStockAlert: {
      type: Number,
      default: 5,
    },
    openingStock: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

productSchema.index({ businessId: 1, name: 1 });

module.exports = mongoose.model('Product', productSchema);
