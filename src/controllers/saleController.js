const Sale = require('../models/Sale');
const { recordSale } = require('../services/accountingService');

// @desc    Get all sales
// @route   GET /api/sales
exports.getSales = async (req, res, next) => {
  try {
    const { customerId, startDate, endDate, paymentStatus, search } = req.query;
    const query = { businessId: req.businessId };

    if (customerId) query.customerId = customerId;
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
      query.$or = [{ invoiceNumber: regex }, { customerName: regex }, { customerPhone: regex }, { notes: regex }];
    }

    const sales = await Sale.find(query).sort({ date: -1, createdAt: -1 });

    let totalSales = 0;
    let totalReceived = 0;
    let totalDue = 0;

    sales.forEach((s) => {
      totalSales += s.netAmount;
      totalReceived += s.paidAmount;
      totalDue += s.dueAmount;
    });

    res.status(200).json({
      success: true,
      count: sales.length,
      summary: {
        totalSales,
        totalReceived,
        totalDue,
      },
      sales,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single sale details (for invoice print / view)
// @route   GET /api/sales/:id
exports.getSaleById = async (req, res, next) => {
  try {
    const sale = await Sale.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    })
      .populate('customerId')
      .populate('accountId')
      .populate('createdBy', 'name avatarColor brotherIndex');

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale invoice not found' });
    }

    res.status(200).json({
      success: true,
      sale,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new sale invoice / POS Bill
// @route   POST /api/sales
exports.createSale = async (req, res, next) => {
  try {
    const {
      customerId,
      items,
      discount,
      paidAmount,
      accountId,
      date,
      notes,
      attachmentUrl,
    } = req.body;

    const result = await recordSale({
      businessId: req.businessId,
      user: req.user,
      customerId,
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
      message: 'Sale invoice generated successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
