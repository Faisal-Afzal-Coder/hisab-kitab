const Purchase = require('../models/Purchase');
const { recordPurchase } = require('../services/accountingService');

// @desc    Get all purchases
// @route   GET /api/purchases
exports.getPurchases = async (req, res, next) => {
  try {
    const { supplierId, startDate, endDate, paymentStatus, search } = req.query;
    const query = { businessId: req.businessId };

    if (supplierId) query.supplierId = supplierId;
    if (paymentStatus && paymentStatus !== 'all') query.paymentStatus = paymentStatus;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ invoiceNumber: regex }, { supplierName: regex }, { notes: regex }];
    }

    const purchases = await Purchase.find(query).sort({ date: -1, createdAt: -1 });

    let totalPurchases = 0;
    let totalPaid = 0;
    let totalDue = 0;

    purchases.forEach((p) => {
      totalPurchases += p.netAmount;
      totalPaid += p.paidAmount;
      totalDue += p.dueAmount;
    });

    res.status(200).json({
      success: true,
      count: purchases.length,
      summary: {
        totalPurchases,
        totalPaid,
        totalDue,
      },
      purchases,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single purchase details
// @route   GET /api/purchases/:id
exports.getPurchaseById = async (req, res, next) => {
  try {
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    })
      .populate('supplierId')
      .populate('accountId')
      .populate('createdBy', 'name avatarColor brotherIndex');

    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase invoice not found' });
    }

    res.status(200).json({
      success: true,
      purchase,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new purchase invoice
// @route   POST /api/purchases
exports.createPurchase = async (req, res, next) => {
  try {
    const {
      supplierId,
      items,
      discount,
      paidAmount,
      accountId,
      date,
      notes,
      attachmentUrl,
    } = req.body;

    const result = await recordPurchase({
      businessId: req.businessId,
      user: req.user,
      supplierId,
      items,
      discount: Number(discount) || 0,
      paidAmount: Number(paidAmount) || 0,
      accountId,
      date: date || new Date(),
      notes,
      attachmentUrl,
    });

    res.status(201).json({
      success: true,
      message: 'Purchase invoice created successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
