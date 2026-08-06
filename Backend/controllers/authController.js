// ============================================================
// controllers/authController.js
// ============================================================
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../config/db');
const { calculateMetrics } = require('../utils/metrics');

// ── POST /api/auth/signup ─────────────────────────────────────

// Used when a new user submits the signup form.
// Creates the user account, calculates starting calorie/protein targets, and returns a login token.
const signup = async (req, res) => {
  const {
    name, email, password, age, gender, weight, height,
    goal, gym_status, activity_level, target_weight,
  } = req.body;

  if (!name || !email || !password || !age || !gender || !weight || !height || !goal) {
    return res.status(400).json({
      success: false,
      message: 'name, email, password, age, gender, weight, height, and goal are all required.',
    });
  }
  if (!['weight_loss', 'weight_gain', 'maintain'].includes(goal)) {
    return res.status(400).json({ success: false, message: 'goal must be one of: weight_loss, weight_gain, maintain.' });
  }
  if (!['male', 'female'].includes(gender)) {
    return res.status(400).json({ success: false, message: 'gender must be male or female.' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const salt           = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { bmr, maintenance_calories, daily_calories, daily_protein } = calculateMetrics(
      weight, height, age, gender, activity_level || 5, goal, gym_status || false
    );

    const result = await pool.query(
      `INSERT INTO users
         (name, email, password, age, gender, weight, height, goal, gym_status, activity_level,
          bmr, maintenance_calories, daily_calories, daily_protein, target_weight)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id, name, email, goal, weight, bmr, maintenance_calories, daily_calories, daily_protein`,
      [
        name,
        email.toLowerCase().trim(),
        hashedPassword,
        parseInt(age),
        gender,
        parseFloat(weight),
        parseFloat(height),
        goal,
        gym_status || false,
        parseInt(activity_level) || 5,
        bmr,
        maintenance_calories,
        daily_calories,
        daily_protein,
        target_weight ? parseFloat(target_weight) : null,
      ]
    );

    const u = result.rows[0];

    const token = jwt.sign(
      { id: u.id, email: u.email, name: u.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: {
        id:                   u.id,
        name:                 u.name,
        email:                u.email,
        goal:                 u.goal,
        weight:               parseFloat(u.weight),
        bmr:                  Math.round(parseFloat(u.bmr)) || bmr,
        maintenance_calories,
        daily_calories:       Math.round(parseFloat(u.daily_calories)),
        daily_protein:        Math.round(parseFloat(u.daily_protein)),
      },
    });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ success: false, message: 'Server error during signup.' });
  }
};

// ── POST /api/auth/login ──────────────────────────────────────

// Used when a user submits the login form.
// Checks the email/password, then returns a JWT token and the user's profile info.
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user    = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Recalculate metrics fresh on each login to stay in sync
    const { bmr, maintenance_calories, daily_calories, daily_protein } = calculateMetrics(
      user.weight, user.height, user.age, user.gender,
      user.activity_level, user.goal, user.gym_status
    );

    // Persist recalculated values
    await pool.query(
      'UPDATE users SET bmr=$1, maintenance_calories=$2, daily_calories=$3, daily_protein=$4 WHERE id=$5',
      [bmr, maintenance_calories, daily_calories, daily_protein, user.id]
    );

    res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id:                   user.id,
        name:                 user.name,
        email:                user.email,
        goal:                 user.goal,
        weight:               parseFloat(user.weight),
        target_weight:        user.target_weight ? parseFloat(user.target_weight) : null,
        bmr,
        maintenance_calories,
        daily_calories,
        daily_protein,
        gym_status:           user.gym_status,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// ── GET /api/auth/profile ─────────────────────────────────────

// Used when the profile page loads for a logged-in user.
// Fetches the user's saved details and returns freshly recalculated calorie/protein targets.
const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, age, gender, weight, height, goal, gym_status,
              activity_level, bmr, maintenance_calories, daily_calories, daily_protein,
              target_weight, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const u = result.rows[0];

    // Always recalculate so profile reflects the current weight
    const { bmr, maintenance_calories, daily_calories, daily_protein } = calculateMetrics(
      u.weight, u.height, u.age, u.gender, u.activity_level, u.goal, u.gym_status
    );

    // Persist if values drifted
    await pool.query(
      'UPDATE users SET bmr=$1, maintenance_calories=$2, daily_calories=$3, daily_protein=$4 WHERE id=$5',
      [bmr, maintenance_calories, daily_calories, daily_protein, u.id]
    );

    res.status(200).json({
      success: true,
      user: {
        ...u,
        weight:               parseFloat(u.weight),
        height:               parseFloat(u.height),
        target_weight:        u.target_weight ? parseFloat(u.target_weight) : null,
        bmr,
        maintenance_calories,
        daily_calories,
        daily_protein,
      },
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── PUT /api/auth/profile ─────────────────────────────────────

// Used when a user saves changes on the profile page (weight, goal, activity level, etc.).
// Updates the user's record and recalculates their calorie/protein targets.
const updateProfile = async (req, res) => {
  const { weight, target_weight, goal, activity_level, gym_status } = req.body;

  if (goal && !['weight_loss', 'weight_gain', 'maintain'].includes(goal)) {
    return res.status(400).json({ success: false, message: 'goal must be one of: weight_loss, weight_gain, maintain.' });
  }

  try {
    const current = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const user = current.rows[0];

    const updatedWeight       = weight          !== undefined ? parseFloat(weight)          : parseFloat(user.weight);
    const updatedGoal         = goal            || user.goal;
    const updatedActivity     = activity_level  !== undefined ? parseInt(activity_level)    : parseInt(user.activity_level);
    const updatedGym          = gym_status      !== undefined ? gym_status                  : user.gym_status;
    const updatedTargetWeight = target_weight   !== undefined
      ? parseFloat(target_weight)
      : (user.target_weight ? parseFloat(user.target_weight) : null);

    const { bmr, maintenance_calories, daily_calories, daily_protein } = calculateMetrics(
      updatedWeight, user.height, user.age, user.gender, updatedActivity, updatedGoal, updatedGym
    );

    const result = await pool.query(
      `UPDATE users
       SET weight=$1, target_weight=$2, goal=$3, activity_level=$4, gym_status=$5,
           bmr=$6, maintenance_calories=$7, daily_calories=$8, daily_protein=$9, updated_at=NOW()
       WHERE id=$10
       RETURNING id, name, email, weight, goal, bmr, maintenance_calories, daily_calories, daily_protein, target_weight, height, age, gender, activity_level, gym_status`,
      [
        updatedWeight, updatedTargetWeight, updatedGoal, updatedActivity, updatedGym,
        bmr, maintenance_calories, daily_calories, daily_protein, req.user.id,
      ]
    );

    const u = result.rows[0];
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      user: {
        ...u,
        weight:               parseFloat(u.weight),
        target_weight:        u.target_weight ? parseFloat(u.target_weight) : null,
        bmr,
        maintenance_calories,
        daily_calories,
        daily_protein,
      },
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { signup, login, getProfile, updateProfile };
