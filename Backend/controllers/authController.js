const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { sendOTPEmail } = require('../utils/emailService');

// ============================================
// IN-MEMORY OTP STORE
// Stores pending signups before email is verified
// Key: email, Value: { otp, expiresAt, userData }
// ============================================
const otpStore = new Map();

// ============================================
// HELPER: Generate 6-digit OTP
// ============================================
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ============================================
// HELPER: Calculate BMR, Daily Calories, Protein
// ============================================
const calculateMetrics = (weight, height, age, gender, activity_level, goal, gym_status) => {
  const w = parseFloat(weight);
  const h = parseFloat(height);
  const a = parseInt(age);
  const al = parseInt(activity_level);

  let bmr;
  if (gender === 'male') {
    bmr = 10 * w + 6.25 * h - 5 * a + 5;
  } else {
    bmr = 10 * w + 6.25 * h - 5 * a - 161;
  }

  let multiplier = 1.2;
  if (al <= 3) multiplier = 1.2;
  else if (al <= 6) multiplier = 1.55;
  else multiplier = 1.9;

  let daily_calories = bmr * multiplier;

  if (goal === 'weight_loss') daily_calories -= 500;
  else if (goal === 'weight_gain') daily_calories += 500;

  const daily_protein = gym_status ? w * 2.2 : w * 1.2;

  return {
    bmr: Math.round(bmr),
    daily_calories: Math.round(daily_calories),
    daily_protein: Math.round(daily_protein),
  };
};

// ============================================
// POST /api/auth/signup
// Step 1: Validate → Send OTP → Store pending
// ============================================
const signup = async (req, res) => {
  const {
    name,
    email,
    password,
    age,
    gender,
    weight,
    height,
    goal,
    gym_status,
    activity_level,
    target_weight,
  } = req.body;

  if (!name || !email || !password || !age || !gender || !weight || !height || !goal) {
    return res.status(400).json({
      success: false,
      message: 'name, email, password, age, gender, weight, height, and goal are all required.',
    });
  }

  if (!['weight_loss', 'weight_gain', 'maintain'].includes(goal)) {
    return res.status(400).json({
      success: false,
      message: 'goal must be one of: weight_loss, weight_gain, maintain.',
    });
  }

  if (!['male', 'female'].includes(gender)) {
    return res.status(400).json({
      success: false,
      message: 'gender must be male or female.',
    });
  }

  try {
    // Check if already registered in DB
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
      email.toLowerCase().trim(),
    ]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    // Hash password now (so we don't store plaintext in memory)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store pending signup data
    otpStore.set(email.toLowerCase().trim(), {
      otp,
      expiresAt,
      userData: {
        name,
        email: email.toLowerCase().trim(),
        hashedPassword,
        age: parseInt(age),
        gender,
        weight: parseFloat(weight),
        height: parseFloat(height),
        goal,
        gym_status: gym_status || false,
        activity_level: parseInt(activity_level) || 5,
        target_weight: target_weight ? parseFloat(target_weight) : null,
      },
    });

    // Send OTP email
    await sendOTPEmail(email.toLowerCase().trim(), name, otp);

    return res.status(200).json({
      success: true,
      message: `OTP sent to ${email}. Please verify your email to complete signup.`,
      email: email.toLowerCase().trim(),
    });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ success: false, message: 'Server error during signup.' });
  }
};

// ============================================
// POST /api/auth/verify-otp
// Step 2: Verify OTP → Create account → Return JWT
// ============================================
const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const pending = otpStore.get(normalizedEmail);

  if (!pending) {
    return res.status(400).json({
      success: false,
      message: 'No pending signup found for this email. Please sign up again.',
    });
  }

  if (Date.now() > pending.expiresAt) {
    otpStore.delete(normalizedEmail);
    return res.status(400).json({
      success: false,
      message: 'OTP has expired. Please sign up again to get a new OTP.',
    });
  }

  if (pending.otp !== otp.toString().trim()) {
    return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
  }

  // OTP is valid — create the account
  try {
    const { userData } = pending;
    const { bmr, daily_calories, daily_protein } = calculateMetrics(
      userData.weight,
      userData.height,
      userData.age,
      userData.gender,
      userData.activity_level,
      userData.goal,
      userData.gym_status
    );

    const result = await pool.query(
      `INSERT INTO users (name, email, password, age, gender, weight, height, goal, gym_status, activity_level, bmr, daily_calories, daily_protein, target_weight)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id, name, email, goal, weight, daily_calories, daily_protein`,
      [
        userData.name,
        userData.email,
        userData.hashedPassword,
        userData.age,
        userData.gender,
        userData.weight,
        userData.height,
        userData.goal,
        userData.gym_status,
        userData.activity_level,
        bmr,
        daily_calories,
        daily_protein,
        userData.target_weight,
      ]
    );

    // Clear OTP from memory
    otpStore.delete(normalizedEmail);

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Email verified! Account created successfully.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        goal: user.goal,
        weight: parseFloat(user.weight),
        daily_calories: Math.round(parseFloat(user.daily_calories)),
        daily_protein: Math.round(parseFloat(user.daily_protein)),
      },
    });
  } catch (err) {
    console.error('Verify OTP error:', err.message);
    res.status(500).json({ success: false, message: 'Server error creating account.' });
  }
};

// ============================================
// POST /api/auth/resend-otp
// Resend a fresh OTP for a pending signup
// ============================================
const resendOTP = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const pending = otpStore.get(normalizedEmail);

  if (!pending) {
    return res.status(400).json({
      success: false,
      message: 'No pending signup found for this email. Please sign up again.',
    });
  }

  // Generate fresh OTP
  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  otpStore.set(normalizedEmail, { ...pending, otp, expiresAt });

  try {
    await sendOTPEmail(normalizedEmail, pending.userData.name, otp);
    return res.status(200).json({
      success: true,
      message: `New OTP sent to ${email}.`,
    });
  } catch (err) {
    console.error('Resend OTP error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to resend OTP.' });
  }
};

// ============================================
// POST /api/auth/login
// ============================================
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [
      email.toLowerCase().trim(),
    ]);

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        goal: user.goal,
        weight: parseFloat(user.weight),
        target_weight: user.target_weight ? parseFloat(user.target_weight) : null,
        daily_calories: Math.round(parseFloat(user.daily_calories) || 0),
        daily_protein: Math.round(parseFloat(user.daily_protein) || 0),
        gym_status: user.gym_status,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// ============================================
// GET /api/auth/profile
// ============================================
const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, age, gender, weight, height, goal, gym_status, 
              activity_level, bmr, daily_calories, daily_protein, target_weight, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const u = result.rows[0];
    res.status(200).json({
      success: true,
      user: {
        ...u,
        weight: parseFloat(u.weight),
        height: parseFloat(u.height),
        target_weight: u.target_weight ? parseFloat(u.target_weight) : null,
        bmr: Math.round(parseFloat(u.bmr) || 0),
        daily_calories: Math.round(parseFloat(u.daily_calories) || 0),
        daily_protein: Math.round(parseFloat(u.daily_protein) || 0),
      },
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ============================================
// PUT /api/auth/profile
// ============================================
const updateProfile = async (req, res) => {
  const { weight, target_weight, goal, activity_level, gym_status } = req.body;

  if (goal && !['weight_loss', 'weight_gain', 'maintain'].includes(goal)) {
    return res.status(400).json({
      success: false,
      message: 'goal must be one of: weight_loss, weight_gain, maintain.',
    });
  }

  try {
    const current = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = current.rows[0];

    const updatedWeight = weight !== undefined ? parseFloat(weight) : parseFloat(user.weight);
    const updatedGoal = goal || user.goal;
    const updatedActivity =
      activity_level !== undefined ? parseInt(activity_level) : parseInt(user.activity_level);
    const updatedGym = gym_status !== undefined ? gym_status : user.gym_status;
    const updatedTargetWeight =
      target_weight !== undefined
        ? parseFloat(target_weight)
        : user.target_weight
        ? parseFloat(user.target_weight)
        : null;

    const { bmr, daily_calories, daily_protein } = calculateMetrics(
      updatedWeight,
      user.height,
      user.age,
      user.gender,
      updatedActivity,
      updatedGoal,
      updatedGym
    );

    const result = await pool.query(
      `UPDATE users 
       SET weight=$1, target_weight=$2, goal=$3, activity_level=$4, gym_status=$5,
           bmr=$6, daily_calories=$7, daily_protein=$8, updated_at=NOW()
       WHERE id=$9
       RETURNING id, name, email, weight, goal, daily_calories, daily_protein, target_weight`,
      [
        updatedWeight,
        updatedTargetWeight,
        updatedGoal,
        updatedActivity,
        updatedGym,
        bmr,
        daily_calories,
        daily_protein,
        req.user.id,
      ]
    );

    const u = result.rows[0];
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      user: {
        ...u,
        weight: parseFloat(u.weight),
        target_weight: u.target_weight ? parseFloat(u.target_weight) : null,
        daily_calories: Math.round(parseFloat(u.daily_calories) || 0),
        daily_protein: Math.round(parseFloat(u.daily_protein) || 0),
      },
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { signup, login, getProfile, updateProfile, verifyOTP, resendOTP };