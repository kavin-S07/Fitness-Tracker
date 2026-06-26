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
      `SELECT id, user_id, food_name, calories, protein, carbs, fats, quantity, unit, meal_type,
              TO_CHAR(date, 'YYYY-MM-DD') AS date, created_at
       FROM foods WHERE user_id = $1 AND date = $2 ORDER BY created_at ASC`,
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
// GET /api/food/history  –  ALL history (no 30-day limit)
// ============================================
const getFoodHistory = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        ROUND(SUM(calories)::numeric, 2) AS total_calories,
        ROUND(SUM(protein)::numeric, 2)  AS total_protein,
        COUNT(*) AS food_count
       FROM foods
       WHERE user_id = $1
       GROUP BY date
       ORDER BY date DESC`,               // 👈 removed INTERVAL '30 days'
      [req.user.id]
    );

    const history = result.rows.map((row) => ({
      date: row.date,                     // PostgreSQL DATE → string 'YYYY-MM-DD'
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
// GET /api/food/date/:date  –  ensure summary keys match frontend
// ============================================
const getFoodByDate = async (req, res) => {
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  try {
    const result = await pool.query(
      `SELECT id, user_id, food_name, calories, protein, carbs, fats, quantity, unit, meal_type,
              TO_CHAR(date, 'YYYY-MM-DD') AS date, created_at
       FROM foods WHERE user_id = $1 AND date = $2 ORDER BY meal_type, created_at`,
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

    const foods = result.rows.map(row => ({
      ...row,
      // date is already 'YYYY-MM-DD' string from TO_CHAR — no conversion needed
      calories: parseFloat(row.calories),
      protein:  parseFloat(row.protein),
      carbs:    parseFloat(row.carbs) || 0,
      fats:     parseFloat(row.fats)  || 0,
      category: row.meal_type,  // frontend uses `category`
    }));

    res.status(200).json({
      success: true,
      date,
      foods,
      summary: {                          // ✅ exact keys needed by FoodPage
        total_calories: Math.round(totals.total_calories),
        total_protein: Math.round(totals.total_protein),
        calorie_target: calorieTarget,
        protein_target: proteinTarget,
        remaining_calories: Math.round(calorieTarget - totals.total_calories),
        remaining_protein: Math.round(proteinTarget - totals.total_protein),
      },
    });
  } catch (err) {
    console.error('Get food by date error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};// ============================================
// PUT /api/food/:id
// ============================================
const updateFood = async (req, res) => {
  const { id } = req.params;
  const { food_name, calories, protein, carbs, fats, category, meal_type, date } = req.body;
  const rawMealType = meal_type || category || '';
  const newMealType = rawMealType.toLowerCase();

  try {
    const existing = await pool.query(
      'SELECT * FROM foods WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Food entry not found.' });
    }

    const current = existing.rows[0];
    const result = await pool.query(
      `UPDATE foods
       SET food_name = $1, calories = $2, protein = $3,
           carbs = $4, fats = $5, meal_type = $6, date = $7
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [
        food_name       ?? current.food_name,
        parseFloat(calories ?? current.calories),
        parseFloat(protein  ?? current.protein),
        parseFloat(carbs    ?? current.carbs),
        parseFloat(fats     ?? current.fats),
        newMealType     || current.meal_type,
        date            || current.date,
        id,
        req.user.id,
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Food entry updated.',
      food: result.rows[0],
    });
  } catch (err) {
    console.error('Update food error:', err);
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


module.exports = { addFood, getTodayFood, getFoodHistory, getFoodByDate, updateFood, deleteFood };