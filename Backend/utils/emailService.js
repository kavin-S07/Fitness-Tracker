const nodemailer = require('nodemailer');

// Create reusable transporter using Gmail + App Password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password (16 chars, no spaces)
  },
});

/**
 * Send OTP verification email
 * @param {string} toEmail - Recipient email
 * @param {string} name    - Recipient name
 * @param {string} otp     - 6-digit OTP
 */
const sendOTPEmail = async (toEmail, name, otp) => {
  const mailOptions = {
    from: `"FitTracker" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: '🔐 Verify Your FitTracker Account',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Email Verification</title>
          <style>
            body { margin: 0; padding: 0; background: #0f0f0f; font-family: 'Segoe UI', Arial, sans-serif; }
            .container { max-width: 520px; margin: 40px auto; background: #1a1a1a; border-radius: 16px; overflow: hidden; border: 1px solid #2a2a2a; }
            .header { background: linear-gradient(135deg, #00c896, #00a57e); padding: 36px 40px; text-align: center; }
            .header h1 { margin: 0; color: #fff; font-size: 26px; font-weight: 700; letter-spacing: 0.5px; }
            .header p { margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; }
            .body { padding: 40px; color: #e0e0e0; }
            .greeting { font-size: 17px; margin-bottom: 16px; }
            .greeting span { color: #00c896; font-weight: 600; }
            .desc { font-size: 14px; color: #aaa; line-height: 1.6; margin-bottom: 28px; }
            .otp-box { background: #111; border: 2px dashed #00c896; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 28px; }
            .otp-label { font-size: 12px; color: #777; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px; }
            .otp-code { font-size: 42px; font-weight: 800; letter-spacing: 10px; color: #00c896; font-family: 'Courier New', monospace; }
            .expiry { font-size: 12px; color: #666; margin-top: 10px; }
            .warning { background: #1e1a10; border-left: 3px solid #f59e0b; padding: 14px 16px; border-radius: 6px; font-size: 13px; color: #d1a520; margin-bottom: 28px; line-height: 1.5; }
            .footer { background: #111; padding: 20px 40px; text-align: center; font-size: 12px; color: #555; border-top: 1px solid #222; }
            .footer a { color: #00c896; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💪 FitTracker</h1>
              <p>Email Verification Required</p>
            </div>
            <div class="body">
              <p class="greeting">Hi, <span>${name}</span>!</p>
              <p class="desc">
                Thanks for signing up! To activate your FitTracker account, please enter the OTP below on the verification page. This code confirms your email address.
              </p>
              <div class="otp-box">
                <div class="otp-label">Your One-Time Password</div>
                <div class="otp-code">${otp}</div>
                <div class="expiry">⏱ Expires in <strong>10 minutes</strong></div>
              </div>
              <div class="warning">
                ⚠️ Never share this code with anyone. FitTracker will never ask for your OTP over call or chat.
              </div>
              <p class="desc">If you didn't create an account, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              © 2025 FitTracker &nbsp;|&nbsp; <a href="#">Privacy Policy</a>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendOTPEmail };