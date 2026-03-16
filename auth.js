const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Admin = require('../models/Admin');
const authMiddleware = require('../middleware/auth');

// ─── LOGIN ────────────────────────────────────────────────────
// POST /api/auth/login
router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { username, password } = req.body;

  try {
    const admin = await Admin.findOne({ username });
    if (!admin) {
      // Delay response ili kuzuia timing attacks
      await new Promise(r => setTimeout(r, 500));
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      await new Promise(r => setTimeout(r, 500));
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: { username: admin.username }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── VERIFY TOKEN ─────────────────────────────────────────────
// GET /api/auth/verify
router.get('/verify', authMiddleware, (req, res) => {
  res.json({ success: true, admin: req.admin });
});

// ─── CHANGE PASSWORD ──────────────────────────────────────────
// PUT /api/auth/change-password
router.put('/change-password', authMiddleware, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { currentPassword, newPassword } = req.body;

  try {
    const admin = await Admin.findById(req.admin.id);
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    admin.password = await bcrypt.hash(newPassword, 12);
    await admin.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── CHANGE USERNAME ──────────────────────────────────────────
// PUT /api/auth/change-username
router.put('/change-username', authMiddleware, [
  body('newUsername').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('currentPassword').notEmpty().withMessage('Password confirmation is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { newUsername, currentPassword } = req.body;

  try {
    const admin = await Admin.findById(req.admin.id);
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Password is incorrect' });
    }

    const exists = await Admin.findOne({ username: newUsername });
    if (exists && exists._id.toString() !== admin._id.toString()) {
      return res.status(409).json({ success: false, message: 'Username already taken' });
    }

    admin.username = newUsername;
    await admin.save();

    // Issue new token with updated username
    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ success: true, message: 'Username updated successfully', token });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
