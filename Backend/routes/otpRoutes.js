// ============================================================
// routes/otpRoutes.js
// Mount in server.js:  app.use('/api/otp', require('./routes/otpRoutes'));
// Frontend env:        REACT_APP_OTP_URL=https://your-backend.com/api/otp
// ============================================================
const express    = require('express');
const nodemailer = require('nodemailer');
const bcrypt     = require('bcryptjs');
const router     = express.Router();

// In-memory OTP store: { email -> { otp, expiresAt } }
const otpStore = {};

// ── Nodemailer transporter ────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error('❌ OTP SMTP Error:', error.message);
  } else {
    console.log('✅ OTP SMTP Ready');
  }
});

// ── POST /api/otp/send-otp ────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }

    const otp       = Math.floor(100000 + Math.random() * 900000);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore[email] = { otp, expiresAt };

    console.log(`[OTP] Sending to ${email} → ${otp}`);

    await transporter.sendMail({
      from: `"FitnessTracker" <${process.env.EMAIL_USER}>`,
      to:      email,
      subject: 'Your FitnessTracker Verification Code',
      text:    `Your verification code is: ${otp}\n\nThis code expires in 10 minutes.\nDo not share it with anyone.`,
      html: `
        <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:2rem;background:#0f1623;border-radius:12px;color:#e2e8f0;">
          <h2 style="color:#4ade80;margin:0 0 0.25rem;">FitnessTracker</h2>
          <p style="color:#94a3b8;margin:0 0 1.25rem;font-size:0.95rem;">Verify your email to complete signup.</p>

          <p style="color:#cbd5e1;font-size:0.9rem;margin-bottom:0.5rem;">Your verification code:</p>
          <div style="font-size:2.4rem;font-weight:700;letter-spacing:0.35em;text-align:center;
                      padding:1.25rem 1rem;background:#1a2535;border-radius:10px;
                      color:#4ade80;border:1px solid rgba(74,222,128,0.25);margin-bottom:1.25rem;">
            ${otp}
          </div>

          <p style="color:#64748b;font-size:0.82rem;margin:0;">
            This code expires in <strong>10 minutes</strong>.<br/>
            If you did not request this, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    return res.json({ success: true, message: 'OTP sent successfully.' });

  } catch (err) {
    console.error('[OTP] Send error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
  }
});

// ── POST /api/otp/verify-otp ──────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const stored = otpStore[email];

    if (!stored) {
      return res.status(400).json({ success: false, message: 'OTP not found. Please request a new one.' });
    }

    if (Date.now() > stored.expiresAt) {
      delete otpStore[email];
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    if (String(stored.otp) !== String(otp)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
    }

    // Valid — clean up
    delete otpStore[email];
    console.log(`[OTP] ✅ Verified for ${email}`);

    return res.json({ success: true, message: 'Email verified successfully.' });

  } catch (err) {
    console.error('[OTP] Verify error:', err.message);
    return res.status(500).json({ success: false, message: 'Verification failed. Please try again.' });
  }
});

module.exports = router;