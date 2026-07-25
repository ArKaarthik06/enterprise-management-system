const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production', {
    expiresIn: '30d',
  });
};

// @desc    Register a new user (customer or product_owner)
// @route   POST /api/auth/signup
exports.signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!['customer', 'product_owner'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role for signup' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const status = role === 'product_owner' ? 'pending' : 'active';

    const user = await User.create({
      name,
      email,
      passwordHash: password, // Will be hashed by pre-save hook
      role,
      status
    });

    res.status(201).json({
      message: 'Signup successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Login user & get token
// @route   POST /api/auth/login
exports.login = (req, res, next) => {
  const passport = require('passport');
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info.message });

    const token = generateToken(user._id);
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  })(req, res, next);
};

// @desc    Approve a pending product owner
// @route   POST /api/auth/approve-owner
exports.approveOwner = async (req, res) => {
  try {
    const { ownerId } = req.body;
    const owner = await User.findById(ownerId);

    if (!owner || owner.role !== 'product_owner') {
      return res.status(404).json({ message: 'Product owner not found' });
    }

    owner.status = 'approved';
    await owner.save();

    // TODO: Send welcome message to owner using Messaging module later.

    res.json({ message: 'Product owner approved successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all users for messaging
// @route   GET /api/auth/users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({}, 'name email role');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
  try {
    const { phone, defaultAddress } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    if (phone !== undefined) user.phone = phone;
    if (defaultAddress !== undefined) user.defaultAddress = defaultAddress;
    
    await user.save();
    res.json({ message: 'Profile updated', user: { id: user._id, name: user.name, phone: user.phone, defaultAddress: user.defaultAddress }});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
