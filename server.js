const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
require('dotenv').config();

const app = express();

// ─── CLOUDINARY ───────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ─── SECURITY ─────────────────────────────────────────────────
app.use(helmet());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, try again later.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts, try again in 15 minutes.' }
});
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many messages sent. Try again in an hour.' }
});

app.use(globalLimiter);

// ─── CORS ─────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'http://localhost:5500'
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── MONGOOSE MODELS ──────────────────────────────────────────
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true }
}, { timestamps: true });
const Admin = mongoose.model('Admin', adminSchema);

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  category: { type: String, required: true, enum: ['branding','motion','video','web'] },
  description: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  imagePublicId: { type: String, default: '' },
  featured: { type: Boolean, default: false },
  order: { type: Number, default: 0 }
}, { timestamps: true });
const Project = mongoose.model('Project', projectSchema);

const testimonialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  role: { type: String, default: '' },
  text: { type: String, required: true, trim: true },
  visible: { type: Boolean, default: true }
}, { timestamps: true });
const Testimonial = mongoose.model('Testimonial', testimonialSchema);

// ─── MULTER ───────────────────────────────────────────────────
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/jpg','image/png','image/webp','image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

// ─── HELPERS ──────────────────────────────────────────────────
function uploadToCloudinary(buffer, folder = 'maglasspro/projects') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', quality: 'auto', fetch_format: 'auto' },
      (error, result) => { if (error) reject(error); else resolve(result); }
    );
    stream.end(buffer);
  });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token provided.' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

// ─── DATABASE ─────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    // Seed admin on first run
    const existing = await Admin.findOne({ username: process.env.ADMIN_USERNAME });
    if (!existing) {
      const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
      await Admin.create({ username: process.env.ADMIN_USERNAME, password: hashed });
      console.log(`✅ Admin created: ${process.env.ADMIN_USERNAME}`);
    }
  })
  .catch(err => { console.error('❌ MongoDB error:', err.message); process.exit(1); });

// ─── HEALTH CHECK ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'MaglassPro API running 🚀', timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════

// POST /api/auth/login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password required' });
  try {
    const admin = await Admin.findOne({ username });
    if (!admin) {
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
    res.json({ success: true, message: 'Login successful', token, admin: { username: admin.username } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/auth/verify
app.get('/api/auth/verify', authMiddleware, (req, res) => {
  res.json({ success: true, admin: req.admin });
});

// PUT /api/auth/change-password
app.put('/api/auth/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Both passwords required' });
  if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
  try {
    const admin = await Admin.findById(req.admin.id);
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    admin.password = await bcrypt.hash(newPassword, 12);
    await admin.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/auth/change-username
app.put('/api/auth/change-username', authMiddleware, async (req, res) => {
  const { newUsername, currentPassword } = req.body;
  if (!newUsername || !currentPassword) return res.status(400).json({ success: false, message: 'All fields required' });
  if (newUsername.length < 3) return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
  try {
    const admin = await Admin.findById(req.admin.id);
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Password is incorrect' });
    admin.username = newUsername;
    await admin.save();
    const token = jwt.sign({ id: admin._id, username: admin.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, message: 'Username updated', token });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ═══════════════════════════════════════
// PROJECTS ROUTES
// ═══════════════════════════════════════

// GET /api/projects
app.get('/api/projects', async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category && category !== 'all' ? { category } : {};
    const projects = await Project.find(filter).sort({ order: 1, createdAt: -1 });
    res.json({ success: true, count: projects.length, projects });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/projects/:id
app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    res.json({ success: true, project });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/projects
app.post('/api/projects', authMiddleware, upload.single('image'), async (req, res) => {
  const { title, category, description, imageUrl, featured } = req.body;
  if (!title) return res.status(400).json({ success: false, message: 'Title is required' });
  if (!category) return res.status(400).json({ success: false, message: 'Category is required' });
  try {
    let finalImageUrl = imageUrl || '';
    let imagePublicId = '';
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      finalImageUrl = result.secure_url;
      imagePublicId = result.public_id;
    }
    const project = await Project.create({ title, category, description: description || '', imageUrl: finalImageUrl, imagePublicId, featured: featured === 'true' });
    res.status(201).json({ success: true, message: 'Project created', project });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/projects/:id
app.put('/api/projects/:id', authMiddleware, upload.single('image'), async (req, res) => {
  const { title, category, description, imageUrl, featured, order } = req.body;
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    if (req.file) {
      if (project.imagePublicId) await cloudinary.uploader.destroy(project.imagePublicId);
      const result = await uploadToCloudinary(req.file.buffer);
      project.imageUrl = result.secure_url;
      project.imagePublicId = result.public_id;
    } else if (imageUrl && imageUrl !== project.imageUrl) {
      project.imageUrl = imageUrl;
    }
    if (title) project.title = title;
    if (category) project.category = category;
    if (description !== undefined) project.description = description;
    if (featured !== undefined) project.featured = featured === 'true';
    if (order !== undefined) project.order = parseInt(order);
    await project.save();
    res.json({ success: true, message: 'Project updated', project });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/projects/:id
app.delete('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    if (project.imagePublicId) await cloudinary.uploader.destroy(project.imagePublicId);
    await project.deleteOne();
    res.json({ success: true, message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ═══════════════════════════════════════
// TESTIMONIALS ROUTES
// ═══════════════════════════════════════

// GET /api/testimonials
app.get('/api/testimonials', async (req, res) => {
  try {
    const testimonials = await Testimonial.find({ visible: true }).sort({ createdAt: -1 });
    res.json({ success: true, count: testimonials.length, testimonials });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/testimonials/all (admin)
app.get('/api/testimonials/all', authMiddleware, async (req, res) => {
  try {
    const testimonials = await Testimonial.find().sort({ createdAt: -1 });
    res.json({ success: true, count: testimonials.length, testimonials });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/testimonials
app.post('/api/testimonials', authMiddleware, async (req, res) => {
  const { name, role, text } = req.body;
  if (!name || !text) return res.status(400).json({ success: false, message: 'Name and text required' });
  try {
    const testimonial = await Testimonial.create({ name, role: role || '', text });
    res.status(201).json({ success: true, message: 'Testimonial added', testimonial });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/testimonials/:id
app.put('/api/testimonials/:id', authMiddleware, async (req, res) => {
  const { name, role, text, visible } = req.body;
  try {
    const t = await Testimonial.findById(req.params.id);
    if (!t) return res.status(404).json({ success: false, message: 'Not found' });
    if (name) t.name = name;
    if (role !== undefined) t.role = role;
    if (text) t.text = text;
    if (visible !== undefined) t.visible = visible;
    await t.save();
    res.json({ success: true, message: 'Testimonial updated', testimonial: t });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/testimonials/:id
app.delete('/api/testimonials/:id', authMiddleware, async (req, res) => {
  try {
    const t = await Testimonial.findById(req.params.id);
    if (!t) return res.status(404).json({ success: false, message: 'Not found' });
    await t.deleteOne();
    res.json({ success: true, message: 'Testimonial deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ═══════════════════════════════════════
// CONTACT ROUTE
// ═══════════════════════════════════════

// POST /api/contact
app.post('/api/contact', contactLimiter, async (req, res) => {
  const { first_name, last_name, email, service, message } = req.body;
  if (!first_name || !email || !service || !message) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  const fullName = `${first_name} ${last_name || ''}`.trim();
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD }
    });

    // Email to Moudrick
    await transporter.sendMail({
      from: `"MaglassPro Website" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_RECEIVER,
      replyTo: email,
      subject: `🎯 New Inquiry: ${service} — ${fullName}`,
      html: `
        <div style="font-family:Arial,sans-serif;background:#050508;color:#f0f4ff;max-width:600px;margin:0 auto;border:1px solid rgba(0,212,255,0.15);">
          <div style="background:#0a0a10;padding:2rem;border-bottom:2px solid #00d4ff;text-align:center;">
            <h1 style="color:#f0f4ff;margin:0;">Maglass<span style="color:#00d4ff;">Pro</span></h1>
            <p style="color:rgba(240,244,255,0.5);font-size:0.8rem;margin:.4rem 0 0;text-transform:uppercase;letter-spacing:.1em;">New Client Inquiry</p>
          </div>
          <div style="padding:2rem;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:.75rem 0;border-bottom:1px solid rgba(120,200,255,0.08);color:rgba(240,244,255,0.5);font-size:.8rem;text-transform:uppercase;width:120px;">From</td><td style="padding:.75rem 0;border-bottom:1px solid rgba(120,200,255,0.08);color:#f0f4ff;font-weight:bold;">${fullName}</td></tr>
              <tr><td style="padding:.75rem 0;border-bottom:1px solid rgba(120,200,255,0.08);color:rgba(240,244,255,0.5);font-size:.8rem;text-transform:uppercase;">Email</td><td style="padding:.75rem 0;border-bottom:1px solid rgba(120,200,255,0.08);"><a href="mailto:${email}" style="color:#00d4ff;">${email}</a></td></tr>
              <tr><td style="padding:.75rem 0;border-bottom:1px solid rgba(120,200,255,0.08);color:rgba(240,244,255,0.5);font-size:.8rem;text-transform:uppercase;">Service</td><td style="padding:.75rem 0;border-bottom:1px solid rgba(120,200,255,0.08);"><span style="background:rgba(0,212,255,0.1);color:#00d4ff;padding:.2rem .8rem;font-size:.8rem;">${service}</span></td></tr>
            </table>
            <div style="margin-top:1.5rem;">
              <p style="color:rgba(240,244,255,0.5);font-size:.8rem;text-transform:uppercase;margin-bottom:.75rem;">Message</p>
              <div style="background:#0a0a10;border:1px solid rgba(120,200,255,0.08);padding:1.2rem;color:rgba(240,244,255,0.8);line-height:1.7;">${message.replace(/\n/g,'<br>')}</div>
            </div>
            <div style="margin-top:1.5rem;text-align:center;">
              <a href="mailto:${email}?subject=Re: ${service} Inquiry" style="display:inline-block;background:#00d4ff;color:#050508;padding:.8rem 2rem;text-decoration:none;font-weight:bold;font-size:.85rem;text-transform:uppercase;">Reply to ${first_name}</a>
            </div>
          </div>
        </div>`
    });

    // Auto-reply to client
    await transporter.sendMail({
      from: `"Moudrick — MaglassPro" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Got your message, ${first_name}! — MaglassPro`,
      html: `
        <div style="font-family:Arial,sans-serif;background:#050508;color:#f0f4ff;max-width:600px;margin:0 auto;border:1px solid rgba(0,212,255,0.15);">
          <div style="background:#0a0a10;padding:2rem;border-bottom:2px solid #00d4ff;text-align:center;">
            <h1 style="color:#f0f4ff;margin:0;">Maglass<span style="color:#00d4ff;">Pro</span></h1>
          </div>
          <div style="padding:2rem;">
            <h2 style="color:#f0f4ff;">Hey ${first_name}! 👋</h2>
            <p style="color:rgba(240,244,255,0.7);line-height:1.7;">Thanks for reaching out! I've received your inquiry about <strong style="color:#00d4ff;">${service}</strong> and I'll get back to you within <strong>24–48 hours</strong>.</p>
            <div style="text-align:center;margin:1.5rem 0;">
              <a href="https://instagram.com/maglasspro_" style="display:inline-block;border:1px solid #00d4ff;color:#00d4ff;padding:.7rem 1.8rem;text-decoration:none;font-size:.82rem;text-transform:uppercase;">@maglasspro_</a>
            </div>
            <p style="color:rgba(240,244,255,0.5);font-size:.85rem;">— Moudrick Shaweji<br>Founder, MaglassPro · Dodoma, Tanzania</p>
          </div>
        </div>`
    });

    res.json({ success: true, message: 'Message sent successfully!' });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ success: false, message: 'Failed to send message. Please try again.' });
  }
});

// ─── 404 ──────────────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── ERROR HANDLER ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
});

// ─── START ────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 MaglassPro API running on port ${PORT}`);
  console.log(`📡 Health: http://localhost:${PORT}/api/health`);
});
