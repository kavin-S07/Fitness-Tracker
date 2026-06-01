const pool = require('../config/db');

// ============================================
// POST /api/food/add
// BUG FIX: Frontend sends `category` (capitalised e.g. "Breakfast").
// Backend column is `meal_type` and validation expects lowercase.
// Accept `meal_type` OR `category` and normalise to lowercase for the DB.
// ============================================
const addFood = async (req, res) => {
  const { food_name, calories, protein, carbs, fats, quantity, unit, date } = req.body;

  // Accept either field name from the frontend
  const rawMealType = req.body.meal_type || req.body.category || '';
  const meal_type = rawMealType.toLowerCase();

  if (!food_name || calories === undefined || protein === undefined) {
    return res.status(400).json({
      success: false,
      message: 'food_name, calories, and protein are required fields.',
    });
  }

  if (!meal_type || !['breakfast', 'lunch', 'dinner', 'snacks'].includes(meal_type)) {
    return res.status(400).json({
      success: false,
      message: 'meal_type must be one of: breakfast, lunch, dinner, snacks.',
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO foods (user_id, food_name, calories, protein, carbs, fats, quantity, unit, meal_type, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        req.user.id,
        food_name,
        parseFloat(calories),
        parseFloat(protein),
        parseFloat(carbs) || 0,
        parseFloat(fats) || 0,
        parseFloat(quantity) || 1,
        unit || 'g',
        meal_type,
        date || new Date().toISOString().split('T')[0],
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Food added successfully!',
      food: result.rows[0],
    });
  } catch (err) {
    console.error('Add food error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ============================================
// GET /api/food/today
// ============================================
const getTodayFood = async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  try {
    const foodResult = await pool.query(
      `SELECT * FROM foods WHERE user_id = $1 AND date = $2 ORDER BY created_at ASC`,
      [req.user.id, today]
    );

    const totals = foodResult.rows.reduce(
      (acc, food) => {
        acc.total_calories += parseFloat(food.calories) || 0;
        acc.total_protein += parseFloat(food.protein) || 0;
        return acc;
      },
      { total_calories: 0, total_protein: 0 }
    );

    const userResult = await pool.query(
      'SELECT daily_calories, daily_protein FROM users WHERE id = $1',
      [req.user.id]
    );
    const targets = userResult.rows[0];
    const calorieTarget = Math.round(parseFloat(targets.daily_calories) || 0);
    const proteinTarget = Math.round(parseFloat(targets.daily_protein) || 0);

    res.status(200).json({
      success: true,
      date: today,
      foods: foodResult.rows,
      totals: {
        total_calories: Math.round(totals.total_calories),
        total_protein: Math.round(totals.total_protein),
        target_calories: calorieTarget,
        target_protein: proteinTarget,
        remaining_calories: Math.round(calorieTarget - totals.total_calories),
        remaining_protein: Math.round(proteinTarget - totals.total_protein),
      },
    });
  } catch (err) {
    console.error('Get today food error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ============================================
// GET /api/food/history
// ============================================
const getFoodHistory = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        date,
        ROUND(SUM(calories)::numeric, 2) AS total_calories,
        ROUND(SUM(protein)::numeric, 2)  AS total_protein,
        COUNT(*) AS food_count
       FROM foods
       WHERE user_id = $1 AND date >= NOW() - INTERVAL '30 days'
       GROUP BY date ORDER BY date DESC`,
      [req.user.id]
    );

    const history = result.rows.map((row) => ({
      date: row.date,
      total_calories: Math.round(parseFloat(row.total_calories) || 0),
      total_protein: Math.round(parseFloat(row.total_protein) || 0),
      food_count: parseInt(row.food_count) || 0,
    }));

    res.status(200).json({ success: true, history });
  } catch (err) {
    console.error('Get food history error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ============================================
// GET /api/food/date/:date
// BUG FIX: Frontend (FoodPage) reads:
//   - res.data.foods        → flat array for category grouping
//   - res.data.summary      → object with calorie_target, protein_target, etc.
// Old response had:
//   - foods_by_meal (grouped object) instead of flat foods array
//   - totals instead of summary, and different key names inside
// Fixed: return both `foods` (flat) and `summary` with correct key names.
// Also normalise food `category` field so frontend filter works correctly
// (DB stores meal_type lowercase; frontend compares against capitalised category).
// ============================================
const getFoodByDate = async (req, res) => {
  const { date } = req.params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM foods WHERE user_id = $1 AND date = $2 ORDER BY meal_type, created_at`,
      [req.user.id, date]
    );

    const userResult = await pool.query(
      'SELECT daily_calories, daily_protein FROM users WHERE id = $1',
      [req.user.id]
    );
    const targets = userResult.rows[0];
    const calorieTarget = Math.round(parseFloat(targets.daily_calories) || 0);
    const proteinTarget = Math.round(parseFloat(targets.daily_protein) || 0);

    const totals = result.rows.reduce(
      (acc, food) => {
        acc.total_calories += parseFloat(food.calories) || 0;
        acc.total_protein += parseFloat(food.protein) || 0;
        return acc;
      },
      { total_calories: 0, total_protein: 0 }
    );

    // BUG FIX: Expose each row's meal_type as `category` so FoodPage's
    // filter (f.category?.toLowerCase() === cat.toLowerCase()) matches.
    const foods = result.rows.map(row => ({
      ...row,
      calories: parseFloat(row.calories),
      protein: parseFloat(row.protein),
      carbs: parseFloat(row.carbs) || 0,
      fats: parseFloat(row.fats) || 0,
      // frontend uses `category` for grouping; DB column is `meal_type`
      category: row.meal_type,
    }));

    res.status(200).json({
      success: true,
      date,
      foods,
      // BUG FIX: `summary` key with calorie_target/protein_target names
      // that FoodPage expects (was `totals` with different keys before)
      summary: {
        total_calories: Math.round(totals.total_calories),
        total_protein: Math.round(totals.total_protein),
        calorie_target: calorieTarget,
        protein_target: proteinTarget,
        remaining_calories: Math.round(calorieTarget - totals.total_calories),
        remaining_protein: Math.round(proteinTarget - totals.total_protein),
      },
      // keep old key for any other callers
      totals: {
        total_calories: Math.round(totals.total_calories),
        total_protein: Math.round(totals.total_protein),
      },
    });
  } catch (err) {
    console.error('Get food by date error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ============================================
// DELETE /api/food/:id
// ============================================
const deleteFood = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM foods WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Food entry not found.' });
    res.status(200).json({ success: true, message: 'Food entry deleted.' });
  } catch (err) {
    console.error('Delete food error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { addFood, getTodayFood, getFoodHistory, getFoodByDate, deleteFood };