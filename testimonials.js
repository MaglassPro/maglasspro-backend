const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Testimonial = require('../models/Testimonial');
const authMiddleware = require('../middleware/auth');

// ─── GET ALL TESTIMONIALS (Public — visible only) ─────────────
// GET /api/testimonials
router.get('/', async (req, res) => {
  try {
    const testimonials = await Testimonial.find({ visible: true }).sort({ createdAt: -1 });
    res.json({ success: true, count: testimonials.length, testimonials });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET ALL TESTIMONIALS (Admin — including hidden) ──────────
// GET /api/testimonials/all
router.get('/all', authMiddleware, async (req, res) => {
  try {
    const testimonials = await Testimonial.find().sort({ createdAt: -1 });
    res.json({ success: true, count: testimonials.length, testimonials });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── CREATE TESTIMONIAL (Admin only) ─────────────────────────
// POST /api/testimonials
router.post('/', authMiddleware, [
  body('name').trim().notEmpty().withMessage('Client name is required').isLength({ max: 80 }),
  body('text').trim().notEmpty().withMessage('Review text is required').isLength({ max: 600 }),
  body('role').optional().isLength({ max: 100 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { name, role, text, visible } = req.body;

  try {
    const testimonial = await Testimonial.create({
      name,
      role: role || '',
      text,
      visible: visible !== false
    });
    res.status(201).json({ success: true, message: 'Testimonial added', testimonial });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── UPDATE TESTIMONIAL (Admin only) ─────────────────────────
// PUT /api/testimonials/:id
router.put('/:id', authMiddleware, async (req, res) => {
  const { name, role, text, visible } = req.body;
  try {
    const testimonial = await Testimonial.findById(req.params.id);
    if (!testimonial) return res.status(404).json({ success: false, message: 'Not found' });

    if (name) testimonial.name = name;
    if (role !== undefined) testimonial.role = role;
    if (text) testimonial.text = text;
    if (visible !== undefined) testimonial.visible = visible;

    await testimonial.save();
    res.json({ success: true, message: 'Testimonial updated', testimonial });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE TESTIMONIAL (Admin only) ─────────────────────────
// DELETE /api/testimonials/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);
    if (!testimonial) return res.status(404).json({ success: false, message: 'Not found' });
    await testimonial.deleteOne();
    res.json({ success: true, message: 'Testimonial deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
