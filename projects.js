const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const authMiddleware = require('../middleware/auth');

// ─── CLOUDINARY CONFIG ────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer — store in memory then upload to Cloudinary
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpg, png, webp, gif)'));
    }
  }
});

// Helper: Upload buffer to Cloudinary
function uploadToCloudinary(buffer, folder = 'maglasspro/projects') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', quality: 'auto', fetch_format: 'auto' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

// ─── GET ALL PROJECTS (Public) ────────────────────────────────
// GET /api/projects
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category && category !== 'all' ? { category } : {};
    const projects = await Project.find(filter).sort({ order: 1, createdAt: -1 });
    res.json({ success: true, count: projects.length, projects });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET SINGLE PROJECT (Public) ─────────────────────────────
// GET /api/projects/:id
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    res.json({ success: true, project });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── CREATE PROJECT (Admin only) ─────────────────────────────
// POST /api/projects
router.post('/', authMiddleware, upload.single('image'), [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 100 }),
  body('category').isIn(['branding', 'motion', 'video', 'web']).withMessage('Invalid category'),
  body('description').optional().isLength({ max: 500 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { title, category, description, imageUrl, featured } = req.body;

  try {
    let finalImageUrl = imageUrl || '';
    let imagePublicId = '';

    // If file uploaded, send to Cloudinary
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      finalImageUrl = result.secure_url;
      imagePublicId = result.public_id;
    }

    const project = await Project.create({
      title,
      category,
      description: description || '',
      imageUrl: finalImageUrl,
      imagePublicId,
      featured: featured === 'true' || featured === true,
      order: 0
    });

    res.status(201).json({ success: true, message: 'Project created', project });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── UPDATE PROJECT (Admin only) ─────────────────────────────
// PUT /api/projects/:id
router.put('/:id', authMiddleware, upload.single('image'), async (req, res) => {
  const { title, category, description, imageUrl, featured, order } = req.body;

  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    // New image uploaded — delete old from Cloudinary first
    if (req.file) {
      if (project.imagePublicId) {
        await cloudinary.uploader.destroy(project.imagePublicId);
      }
      const result = await uploadToCloudinary(req.file.buffer);
      project.imageUrl = result.secure_url;
      project.imagePublicId = result.public_id;
    } else if (imageUrl && imageUrl !== project.imageUrl) {
      // New Cloudinary URL pasted manually
      project.imageUrl = imageUrl;
    }

    if (title) project.title = title;
    if (category) project.category = category;
    if (description !== undefined) project.description = description;
    if (featured !== undefined) project.featured = featured === 'true' || featured === true;
    if (order !== undefined) project.order = parseInt(order);

    await project.save();
    res.json({ success: true, message: 'Project updated', project });
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE PROJECT (Admin only) ─────────────────────────────
// DELETE /api/projects/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    // Delete image from Cloudinary
    if (project.imagePublicId) {
      await cloudinary.uploader.destroy(project.imagePublicId);
    }

    await project.deleteOne();
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
