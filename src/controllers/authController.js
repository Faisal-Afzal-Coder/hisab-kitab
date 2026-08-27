const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Business = require('../models/Business');
const Account = require('../models/Account');
const { logActivity } = require('../services/auditService');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, businessId: user.businessId },
    process.env.JWT_SECRET || 'hisab_kitab_super_secret_jwt_key_2026_brothers_biz',
    { expiresIn: '30d' }
  );
};

// @desc    Register a new user / workspace
// @route   POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, phone, businessName, role } = req.body;

    let existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    // Create Business workspace
    const business = new Business({
      name: businessName || 'Joint Brothers Business',
      currency: 'Rs.',
      phone: phone || '',
    });
    await business.save();

    // Create User
    const user = new User({
      name,
      email: email.toLowerCase(),
      phone: phone || '',
      password,
      role: role || 'owner',
      businessId: business._id,
      brotherIndex: 1,
      avatarColor: '#10b981', // Emerald
    });
    await user.save();

    business.ownerId = user._id;
    business.members.push({ userId: user._id, role: user.role, title: 'Owner (Brother 1)' });
    await business.save();

    // Create Default Cash in Hand Account
    const cashAccount = new Account({
      businessId: business._id,
      name: 'Cash in Hand (Naqd)',
      type: 'cash',
      openingBalance: 0,
      currentBalance: 0,
      isDefault: true,
      createdBy: user._id,
    });
    await cashAccount.save();

    const token = generateToken(user);

    await logActivity({
      businessId: business._id,
      user,
      action: 'LOGIN',
      module: 'Auth',
      entityId: user._id,
      description: `${user.name} registered and initialized the business workspace`,
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        businessId: user.businessId,
        brotherIndex: user.brotherIndex,
        avatarColor: user.avatarColor,
      },
      business,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    user.lastLogin = Date.now();
    await user.save();

    const business = await Business.findById(user.businessId);
    const token = generateToken(user);

    await logActivity({
      businessId: user.businessId,
      user,
      action: 'LOGIN',
      module: 'Auth',
      entityId: user._id,
      description: `${user.name} logged into Hisab-Kitab workspace`,
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        businessId: user.businessId,
        brotherIndex: user.brotherIndex,
        avatarColor: user.avatarColor,
      },
      business,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Current Logged in User
// @route   GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const business = await Business.findById(req.businessId);
    res.status(200).json({
      success: true,
      user,
      business,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get All Brothers / Users in Business Workspace
// @route   GET /api/auth/brothers
exports.getBrothers = async (req, res, next) => {
  try {
    const brothers = await User.find({ businessId: req.businessId }).sort({ brotherIndex: 1, createdAt: 1 });
    res.status(200).json({
      success: true,
      count: brothers.length,
      brothers,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Quick Seed or Switch Brother (convenience for demo & 3 brothers collaboration)
// @route   POST /api/auth/switch-brother
exports.switchBrother = async (req, res, next) => {
  try {
    const { brotherIndex } = req.body;
    const targetBrother = await User.findOne({
      businessId: req.businessId,
      brotherIndex: Number(brotherIndex),
    });

    if (!targetBrother) {
      return res.status(404).json({ success: false, message: `Brother ${brotherIndex} not found` });
    }

    const token = generateToken(targetBrother);
    const business = await Business.findById(req.businessId);

    res.status(200).json({
      success: true,
      token,
      user: {
        _id: targetBrother._id,
        name: targetBrother.name,
        email: targetBrother.email,
        phone: targetBrother.phone,
        role: targetBrother.role,
        businessId: targetBrother.businessId,
        brotherIndex: targetBrother.brotherIndex,
        avatarColor: targetBrother.avatarColor,
      },
      business,
    });
  } catch (error) {
    next(error);
  }
};
