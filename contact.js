const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

// Rate limit — max messages 5 kwa saa 1 per IP
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many messages sent. Please try again in an hour.' }
});

// ─── EMAIL TRANSPORTER ────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

// ─── SEND CONTACT EMAIL ───────────────────────────────────────
// POST /api/contact
router.post('/', contactLimiter, [
  body('first_name').trim().notEmpty().withMessage('Name is required').isLength({ max: 50 }),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('service').notEmpty().withMessage('Service is required'),
  body('message').trim().isLength({ min: 10, max: 2000 }).withMessage('Message must be between 10 and 2000 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { first_name, last_name, email, service, message } = req.body;
  const fullName = `${first_name} ${last_name || ''}`.trim();

  try {
    // ── Email kwenda kwa wewe (Moudrick) ──
    const toOwnerMail = {
      from: `"MaglassPro Website" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_RECEIVER,
      replyTo: email,
      subject: `🎯 New Inquiry: ${service} — ${fullName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; background: #050508; color: #f0f4ff; padding: 0; margin: 0;">
          <div style="max-width: 600px; margin: 0 auto; background: #12121e; border: 1px solid rgba(0,212,255,0.15);">
            
            <!-- Header -->
            <div style="background: #0a0a10; padding: 2rem; border-bottom: 2px solid #00d4ff; text-align: center;">
              <h1 style="color: #f0f4ff; font-size: 1.4rem; margin: 0; letter-spacing: -0.02em;">
                Maglass<span style="color: #00d4ff;">Pro</span>
              </h1>
              <p style="color: rgba(240,244,255,0.5); font-size: 0.8rem; margin: 0.4rem 0 0; text-transform: uppercase; letter-spacing: 0.1em;">New Client Inquiry</p>
            </div>

            <!-- Body -->
            <div style="padding: 2rem;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 0.75rem 0; border-bottom: 1px solid rgba(120,200,255,0.08); color: rgba(240,244,255,0.5); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; width: 120px;">From</td>
                  <td style="padding: 0.75rem 0; border-bottom: 1px solid rgba(120,200,255,0.08); color: #f0f4ff; font-weight: bold;">${fullName}</td>
                </tr>
                <tr>
                  <td style="padding: 0.75rem 0; border-bottom: 1px solid rgba(120,200,255,0.08); color: rgba(240,244,255,0.5); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em;">Email</td>
                  <td style="padding: 0.75rem 0; border-bottom: 1px solid rgba(120,200,255,0.08);"><a href="mailto:${email}" style="color: #00d4ff; text-decoration: none;">${email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 0.75rem 0; border-bottom: 1px solid rgba(120,200,255,0.08); color: rgba(240,244,255,0.5); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em;">Service</td>
                  <td style="padding: 0.75rem 0; border-bottom: 1px solid rgba(120,200,255,0.08);"><span style="background: rgba(0,212,255,0.1); color: #00d4ff; padding: 0.2rem 0.8rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em;">${service}</span></td>
                </tr>
              </table>

              <div style="margin-top: 1.5rem;">
                <p style="color: rgba(240,244,255,0.5); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.75rem;">Message</p>
                <div style="background: #0a0a10; border: 1px solid rgba(120,200,255,0.08); padding: 1.2rem; color: rgba(240,244,255,0.8); line-height: 1.7; font-size: 0.95rem;">
                  ${message.replace(/\n/g, '<br>')}
                </div>
              </div>

              <div style="margin-top: 1.5rem; text-align: center;">
                <a href="mailto:${email}?subject=Re: ${service} Inquiry" style="display: inline-block; background: #00d4ff; color: #050508; padding: 0.8rem 2rem; text-decoration: none; font-weight: bold; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em;">Reply to ${first_name}</a>
              </div>
            </div>

            <!-- Footer -->
            <div style="padding: 1rem 2rem; border-top: 1px solid rgba(120,200,255,0.08); text-align: center;">
              <p style="color: rgba(240,244,255,0.28); font-size: 0.75rem; margin: 0;">MaglassPro Portfolio · Dar es Salaam, Tanzania</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    // ── Auto-reply kwenda kwa mteja ──
    const toClientMail = {
      from: `"Moudrick — MaglassPro" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Got your message, ${first_name}! — MaglassPro`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; background: #050508; color: #f0f4ff; padding: 0; margin: 0;">
          <div style="max-width: 600px; margin: 0 auto; background: #12121e; border: 1px solid rgba(0,212,255,0.15);">
            <div style="background: #0a0a10; padding: 2rem; border-bottom: 2px solid #00d4ff; text-align: center;">
              <h1 style="color: #f0f4ff; font-size: 1.4rem; margin: 0;">Maglass<span style="color: #00d4ff;">Pro</span></h1>
            </div>
            <div style="padding: 2rem;">
              <h2 style="color: #f0f4ff; font-size: 1.2rem; margin: 0 0 1rem;">Hey ${first_name}! 👋</h2>
              <p style="color: rgba(240,244,255,0.7); line-height: 1.7;">Thanks for reaching out! I've received your inquiry about <strong style="color: #00d4ff;">${service}</strong> and I'll get back to you within <strong>24–48 hours</strong>.</p>
              <p style="color: rgba(240,244,255,0.7); line-height: 1.7;">In the meantime, feel free to check out more of my work on Instagram:</p>
              <div style="text-align: center; margin: 1.5rem 0;">
                <a href="https://instagram.com/maglasspro_" style="display: inline-block; background: transparent; border: 1px solid #00d4ff; color: #00d4ff; padding: 0.7rem 1.8rem; text-decoration: none; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.08em;">@maglasspro_</a>
              </div>
              <p style="color: rgba(240,244,255,0.5); font-size: 0.85rem;">— Moudrick Shaweji<br>Founder, MaglassPro · Dar es Salaam</p>
            </div>
            <div style="padding: 1rem 2rem; border-top: 1px solid rgba(120,200,255,0.08); text-align: center;">
              <p style="color: rgba(240,244,255,0.28); font-size: 0.72rem; margin: 0;">This is an automated reply. Do not reply to this email directly.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(toOwnerMail);
    await transporter.sendMail(toClientMail);

    res.json({
      success: true,
      message: 'Message sent successfully! Check your email for confirmation.'
    });

  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again or contact us directly.'
    });
  }
});

module.exports = router;
