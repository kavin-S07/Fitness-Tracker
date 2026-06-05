// ============================================================
// routes/otpRoutes.js
// Mount in server.js:  app.use('/api/otp', require('./routes/otpRoutes'));
// Frontend env:        REACT_APP_OTP_URL=https://your-backend.com/api/otp
//
// Email provider: Resend (https://resend.com)
//   - Uses HTTPS (port 443) — works on ALL cloud hosts including Render free tier
//   - Free tier: 3,000 emails/month, 100/day
//   - Required env var: RESEND_API_KEY
//   - FROM address: set RESEND_FROM in env, e.g. "FitnessTracker <onboarding@resend.dev>"
//     (use onboarding@resend.dev for testing; add your own domain later for production)
// ============================================================
const express = require('express');
const { Resend } = require('resend');
const router  = express.Router();

// In-memory OTP store: { email -> { otp, expiresAt } }
const otpStore = {};

// ── Resend client ─────────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

// Startup check — confirms the key is present
if (!process.env.RESEND_API_KEY) {
  console.error('❌ OTP Email Error: RESEND_API_KEY is not set in environment variables.');
} else {
  console.log('✅ OTP Email Ready (Resend)');
}

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

    const fromAddress = process.env.RESEND_FROM || 'FitnessTracker <onboarding@resend.dev>';

    const { error: sendError } = await resend.emails.send({
      from:    fromAddress,
      to:      [email],
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

    if (sendError) {
      console.error('[OTP] Resend API error:', sendError.message);
      // Clean up the stored OTP so the user can retry cleanly
      delete otpStore[email];
      return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
    }

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