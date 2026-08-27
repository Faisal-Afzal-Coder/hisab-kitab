const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const { logActivity } = require('../services/auditService');

// @desc    Get all products with stock counts & valuation
// @route   GET /api/products
exports.getProducts = async (req, res, next) => {
  try {
    const { search, category, lowStockOnly } = req.query;
    const query = { businessId: req.businessId, isActive: true };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: regex }, { code: regex }, { category: regex }];
    }

    let products = await Product.find(query).sort({ name: 1 });

    if (lowStockOnly === 'true') {
      products = products.filter((p) => p.currentStock <= p.minStockAlert);
    }

    // Calculate inventory valuation
    let totalStockValue = 0;
    let totalStockItems = 0;
    let lowStockCount = 0;

    const allProducts = await Product.find({ businessId: req.businessId, isActive: true });
    allProducts.forEach((p) => {
      totalStockValue += p.currentStock * p.purchasePrice;
      totalStockItems += p.currentStock;
      if (p.currentStock <= p.minStockAlert) lowStockCount++;
    });

    res.status(200).json({
      success: true,
      count: products.length,
      summary: {
        totalProducts: allProducts.length,
        totalStockItems,
        totalStockValue,
        lowStockCount,
      },
      products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create product
// @route   POST /api/products
exports.createProduct = async (req, res, next) => {
  try {
    const { name, code, category, unit, purchasePrice, salePrice, openingStock, minStockAlert, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide product name' });
    }

    const numOpening = Number(openingStock) || 0;

    const product = new Product({
      businessId: req.businessId,
      name: name.trim(),
      code: code || '',
      category: category || 'General',
      unit: unit || 'pcs',
      purchasePrice: Number(purchasePrice) || 0,
      salePrice: Number(salePrice) || 0,
      openingStock: numOpening,
      currentStock: numOpening,
      minStockAlert: Number(minStockAlert) || 5,
      description: description || '',
      createdBy: req.user._id,
    });

    await product.save();

    await logActivity({
      businessId: req.businessId,
      user: req.user,
      action: 'CREATE',
      module: 'Product',
      entityId: product._id,
      description: `${req.user.name} added new product '${product.name}' with initial stock ${numOpening} ${product.unit}`,
      amount: product.purchasePrice * numOpening,
    });

    res.status(201).json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
exports.updateProduct = async (req, res, next) => {
  try {
    const { name, code, category, unit, purchasePrice, salePrice, minStockAlert, description } = req.body;

    const product = await Product.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (name) product.name = name.trim();
    if (code !== undefined) product.code = code;
    if (category) product.category = category;
    if (unit) product.unit = unit;
    if (purchasePrice !== undefined) product.purchasePrice = Number(purchasePrice);
    if (salePrice !== undefined) product.salePrice = Number(salePrice);
    if (minStockAlert !== undefined) product.minStockAlert = Number(minStockAlert);
    if (description !== undefined) product.description = description;

    await product.save();

    await logActivity({
      businessId: req.businessId,
      user: req.user,
      action: 'UPDATE',
      module: 'Product',
      entityId: product._id,
      description: `${req.user.name} updated product details for '${product.name}'`,
    });

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manual Stock Adjustment (damage, audit count, return)
// @route   POST /api/products/:id/adjust-stock
exports.adjustStock = async (req, res, next) => {
  try {
    const { adjustedQuantity, adjustmentType, reason } = req.body;
    // adjustmentType: 'add', 'subtract', 'set'

    const product = await Product.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const previousStock = product.currentStock;
    const qty = Number(adjustedQuantity);

    if (adjustmentType === 'add') {
      product.currentStock += qty;
    } else if (adjustmentType === 'subtract') {
      product.currentStock -= qty;
    } else if (adjustmentType === 'set') {
      product.currentStock = qty;
    }

    await product.save();

    await logActivity({
      businessId: req.businessId,
      user: req.user,
      action: 'UPDATE',
      module: 'Product',
      entityId: product._id,
      description: `${req.user.name} adjusted stock for '${product.name}' from ${previousStock} to ${product.currentStock} ${product.unit} (Reason: ${reason || 'Manual Adjustment'})`,
      metadata: { previousStock, newStock: product.currentStock, reason },
    });

    res.status(200).json({
      success: true,
      message: `Stock updated successfully`,
      product,
    });
  } catch (error) {
    next(error);
  }
};
