const Party = require('../models/Party');
const Transaction = require('../models/Transaction');
const {
  recordPaymentIn,
  recordPaymentOut,
  getPartyStatement,
} = require('../services/accountingService');
const { logActivity } = require('../services/auditService');

// @desc    Get all parties with filters and search
// @route   GET /api/parties
exports.getParties = async (req, res, next) => {
  try {
    const { type, search, status } = req.query;
    const query = { businessId: req.businessId, isActive: true };

    if (type && type !== 'all') {
      query.type = type;
    }

    if (status === 'receivable') {
      query.currentBalance = { $gt: 0.01 };
    } else if (status === 'payable') {
      query.currentBalance = { $lt: -0.01 };
    } else if (status === 'settled') {
      query.currentBalance = { $gte: -0.01, $lte: 0.01 };
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: regex },
        { phone: regex },
        { email: regex },
        { address: regex },
      ];
    }

    const parties = await Party.find(query).sort({ name: 1 });

    // Aggregate summary
    const allParties = await Party.find({ businessId: req.businessId, isActive: true });
    let totalReceivables = 0;
    let totalPayables = 0;

    allParties.forEach((p) => {
      if (p.currentBalance > 0.01) {
        totalReceivables += p.currentBalance;
      } else if (p.currentBalance < -0.01) {
        totalPayables += Math.abs(p.currentBalance);
      }
    });

    res.status(200).json({
      success: true,
      count: parties.length,
      summary: {
        totalParties: allParties.length,
        totalReceivables,
        totalPayables,
        netBalance: totalReceivables - totalPayables,
      },
      parties,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Lene Hain (Receivables List) - Customers who owe money
// @route   GET /api/parties/receivables
exports.getReceivables = async (req, res, next) => {
  try {
    const { search } = req.query;
    const query = {
      businessId: req.businessId,
      isActive: true,
      currentBalance: { $gt: 0.01 }, // Positive balance = customer owes us
    };

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: regex }, { phone: regex }, { address: regex }];
    }

    const parties = await Party.find(query).sort({ currentBalance: -1 });

    let totalReceivable = 0;
    const partyData = await Promise.all(
      parties.map(async (p) => {
        totalReceivable += p.currentBalance;

        // Get last transaction for this party
        const lastTxn = await Transaction.findOne({
          businessId: req.businessId,
          partyId: p._id,
          isVoid: false,
        }).sort({ date: -1, createdAt: -1 });

        // Calculate total sales / total received for clear stats
        const txns = await Transaction.find({
          businessId: req.businessId,
          partyId: p._id,
          isVoid: false,
        });

        let totalBilled = p.openingBalanceType === 'receivable' ? p.openingBalance : 0;
        let totalReceived = 0;

        txns.forEach((t) => {
          if (t.type === 'sale') totalBilled += t.amount;
          if (t.type === 'payment_in') totalReceived += t.amount;
          if (t.type === 'sale' && t.moneyIn > 0) totalReceived += t.moneyIn;
        });

        return {
          _id: p._id,
          name: p.name,
          phone: p.phone,
          email: p.email,
          address: p.address,
          type: p.type,
          totalDue: totalBilled,
          totalReceived,
          remainingAmount: p.currentBalance,
          lastTransaction: lastTxn
            ? {
                date: lastTxn.date,
                type: lastTxn.type,
                amount: lastTxn.amount,
                createdByName: lastTxn.createdByName,
                brotherIndex: lastTxn.brotherIndex,
              }
            : null,
          createdAt: p.createdAt,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: partyData.length,
      totalReceivable,
      parties: partyData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Dene Hain (Payables List) - Suppliers we owe money to
// @route   GET /api/parties/payables
exports.getPayables = async (req, res, next) => {
  try {
    const { search } = req.query;
    const query = {
      businessId: req.businessId,
      isActive: true,
      currentBalance: { $lt: -0.01 }, // Negative balance = we owe supplier
    };

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: regex }, { phone: regex }, { address: regex }];
    }

    const parties = await Party.find(query).sort({ currentBalance: 1 });

    let totalPayable = 0;
    const partyData = await Promise.all(
      parties.map(async (p) => {
        const absolutePayable = Math.abs(p.currentBalance);
        totalPayable += absolutePayable;

        // Get last transaction for this party
        const lastTxn = await Transaction.findOne({
          businessId: req.businessId,
          partyId: p._id,
          isVoid: false,
        }).sort({ date: -1, createdAt: -1 });

        // Calculate total purchases / total paid
        const txns = await Transaction.find({
          businessId: req.businessId,
          partyId: p._id,
          isVoid: false,
        });

        let totalPurchased = p.openingBalanceType === 'payable' ? p.openingBalance : 0;
        let totalPaid = 0;

        txns.forEach((t) => {
          if (t.type === 'purchase') totalPurchased += t.amount;
          if (t.type === 'payment_out') totalPaid += t.amount;
          if (t.type === 'purchase' && t.moneyOut > 0) totalPaid += t.moneyOut;
        });

        return {
          _id: p._id,
          name: p.name,
          phone: p.phone,
          email: p.email,
          address: p.address,
          type: p.type,
          totalPayable: totalPurchased,
          totalPaid,
          remainingPayable: absolutePayable,
          rawBalance: p.currentBalance,
          lastTransaction: lastTxn
            ? {
                date: lastTxn.date,
                type: lastTxn.type,
                amount: lastTxn.amount,
                createdByName: lastTxn.createdByName,
                brotherIndex: lastTxn.brotherIndex,
              }
            : null,
          createdAt: p.createdAt,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: partyData.length,
      totalPayable,
      parties: partyData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Party Statement (Full Khata Ledger)
// @route   GET /api/parties/:id/statement
exports.getPartyStatement = async (req, res, next) => {
  try {
    const statement = await getPartyStatement(req.businessId, req.params.id);
    res.status(200).json({
      success: true,
      statement,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single party profile
// @route   GET /api/parties/:id
exports.getPartyById = async (req, res, next) => {
  try {
    const party = await Party.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!party) {
      return res.status(404).json({ success: false, message: 'Party not found' });
    }

    res.status(200).json({
      success: true,
      party,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new party (Customer, Supplier, Partner)
// @route   POST /api/parties
exports.createParty = async (req, res, next) => {
  try {
    const { name, phone, email, type, openingBalance, openingBalanceType, address, creditLimit, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide party name' });
    }

    let initialBalance = 0;
    const numOpening = Number(openingBalance) || 0;
    if (openingBalanceType === 'receivable') {
      initialBalance = numOpening;
    } else if (openingBalanceType === 'payable') {
      initialBalance = -numOpening;
    }

    const party = new Party({
      businessId: req.businessId,
      name: name.trim(),
      phone: phone || '',
      email: email || '',
      type: type || 'customer',
      openingBalance: numOpening,
      openingBalanceType: openingBalanceType || 'none',
      currentBalance: initialBalance,
      address: address || '',
      creditLimit: Number(creditLimit) || 0,
      notes: notes || '',
      createdBy: req.user._id,
      createdByName: req.user.name,
    });

    await party.save();

    await logActivity({
      businessId: req.businessId,
      user: req.user,
      action: 'CREATE',
      module: 'Party',
      entityId: party._id,
      description: `${req.user.name} added new party '${party.name}' (${party.type})`,
      partyName: party.name,
      amount: numOpening,
    });

    res.status(201).json({
      success: true,
      party,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update party details
// @route   PUT /api/parties/:id
exports.updateParty = async (req, res, next) => {
  try {
    const { name, phone, email, type, address, creditLimit, notes } = req.body;

    const party = await Party.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!party) {
      return res.status(404).json({ success: false, message: 'Party not found' });
    }

    if (name) party.name = name.trim();
    if (phone !== undefined) party.phone = phone;
    if (email !== undefined) party.email = email;
    if (type) party.type = type;
    if (address !== undefined) party.address = address;
    if (creditLimit !== undefined) party.creditLimit = Number(creditLimit);
    if (notes !== undefined) party.notes = notes;

    await party.save();

    await logActivity({
      businessId: req.businessId,
      user: req.user,
      action: 'UPDATE',
      module: 'Party',
      entityId: party._id,
      description: `${req.user.name} updated party profile for '${party.name}'`,
      partyName: party.name,
    });

    res.status(200).json({
      success: true,
      party,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    1-Click Quick Receive Payment from Lene Hain
// @route   POST /api/parties/:id/receive-payment
exports.receivePayment = async (req, res, next) => {
  try {
    const { accountId, amount, date, reference, description, attachmentUrl } = req.body;

    const result = await recordPaymentIn({
      businessId: req.businessId,
      user: req.user,
      partyId: req.params.id,
      accountId,
      amount: Number(amount),
      date: date || new Date(),
      reference,
      description,
      attachmentUrl,
    });

    res.status(200).json({
      success: true,
      message: `Successfully received Rs. ${Number(amount).toLocaleString()} from ${result.party.name}`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    1-Click Quick Make Payment to Supplier from Dene Hain
// @route   POST /api/parties/:id/make-payment
exports.makePayment = async (req, res, next) => {
  try {
    const { accountId, amount, date, reference, description, attachmentUrl } = req.body;

    const result = await recordPaymentOut({
      businessId: req.businessId,
      user: req.user,
      partyId: req.params.id,
      accountId,
      amount: Number(amount),
      date: date || new Date(),
      reference,
      description,
      attachmentUrl,
    });

    res.status(200).json({
      success: true,
      message: `Successfully paid Rs. ${Number(amount).toLocaleString()} to ${result.party.name}`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
