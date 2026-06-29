const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { db } = require('../db');
const { users } = require('../db/schema');
const { eq } = require('drizzle-orm');
const { calculateMetrics } = require('../utils/metrics');

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
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase().trim()));
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const salt           = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { bmr, maintenance_calories, daily_calories, daily_protein } = calculateMetrics(
      weight, height, age, gender, activity_level || 5, goal, gym_status || false
    );

    const result = await db.insert(users).values({
      name,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      age: parseInt(age),
      gender,
      weight: parseFloat(weight),
      height: parseFloat(height),
      goal,
      gym_status: gym_status || false,
      activity_level: parseInt(activity_level) || 5,
      bmr,
      maintenance_calories,
      daily_calories,
      daily_protein,
      target_weight: target_weight ? parseFloat(target_weight) : null,
    }).returning();

    const u = result[0];

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

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const result = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    if (result.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user    = result[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { bmr, maintenance_calories, daily_calories, daily_protein } = calculateMetrics(
      user.weight, user.height, user.age, user.gender,
      user.activity_level, user.goal, user.gym_status
    );

    await db.update(users).set({
      bmr,
      maintenance_calories,
      daily_calories,
      daily_protein,
    }).where(eq(users.id, user.id));

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

const getProfile = async (req, res) => {
  try {
    const result = await db.select({
      id: users.id, name: users.name, email: users.email, age: users.age,
      gender: users.gender, weight: users.weight, height: users.height,
      goal: users.goal, gym_status: users.gym_status,
      activity_level: users.activity_level, bmr: users.bmr,
      maintenance_calories: users.maintenance_calories,
      daily_calories: users.daily_calories, daily_protein: users.daily_protein,
      target_weight: users.target_weight, created_at: users.created_at,
    }).from(users).where(eq(users.id, req.user.id));

    if (result.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const u = result[0];

    const { bmr, maintenance_calories, daily_calories, daily_protein } = calculateMetrics(
      u.weight, u.height, u.age, u.gender, u.activity_level, u.goal, u.gym_status
    );

    await db.update(users).set({
      bmr,
      maintenance_calories,
      daily_calories,
      daily_protein,
    }).where(eq(users.id, u.id));

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

const updateProfile = async (req, res) => {
  const { weight, target_weight, goal, activity_level, gym_status } = req.body;

  if (goal && !['weight_loss', 'weight_gain', 'maintain'].includes(goal)) {
    return res.status(400).json({ success: false, message: 'goal must be one of: weight_loss, weight_gain, maintain.' });
  }

  try {
    const current = await db.select().from(users).where(eq(users.id, req.user.id));
    if (current.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const user = current[0];

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

    const result = await db.update(users).set({
      weight: updatedWeight,
      target_weight: updatedTargetWeight,
      goal: updatedGoal,
      activity_level: updatedActivity,
      gym_status: updatedGym,
      bmr,
      maintenance_calories,
      daily_calories,
      daily_protein,
      updated_at: new Date(),
    }).where(eq(users.id, req.user.id)).returning({
      id: users.id, name: users.name, email: users.email, weight: users.weight,
      goal: users.goal, bmr: users.bmr, maintenance_calories: users.maintenance_calories,
      daily_calories: users.daily_calories, daily_protein: users.daily_protein,
      target_weight: users.target_weight, height: users.height, age: users.age,
      gender: users.gender, activity_level: users.activity_level, gym_status: users.gym_status,
    });

    const u = result[0];
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
