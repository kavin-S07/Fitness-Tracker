const { db } = require('../db');
const { users, foods } = require('../db/schema');
const { eq, and, sql } = require('drizzle-orm');

const addFood = async (req, res) => {
  const { food_name, calories, protein, carbs, fats, quantity, unit, date } = req.body;
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
    const result = await db.insert(foods).values({
      user_id: req.user.id,
      food_name,
      calories: parseFloat(calories),
      protein: parseFloat(protein),
      carbs: parseFloat(carbs) || 0,
      fats: parseFloat(fats) || 0,
      quantity: parseFloat(quantity) || 1,
      unit: unit || 'g',
      meal_type,
      date: date || new Date().toISOString().split('T')[0],
    }).returning();

    res.status(201).json({
      success: true,
      message: 'Food added successfully!',
      food: result[0],
    });
  } catch (err) {
    console.error('Add food error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getTodayFood = async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  try {
    const foodResult = await db.execute(sql`
      SELECT id, user_id, food_name, calories, protein, carbs, fats, quantity, unit, meal_type,
             TO_CHAR(date, 'YYYY-MM-DD') AS date, created_at
      FROM foods WHERE user_id = ${req.user.id} AND date = ${today} ORDER BY created_at ASC
    `);

    const rows = foodResult.rows;
    const totals = rows.reduce(
      (acc, food) => {
        acc.total_calories += parseFloat(food.calories) || 0;
        acc.total_protein += parseFloat(food.protein) || 0;
        return acc;
      },
      { total_calories: 0, total_protein: 0 }
    );

    const userResult = await db.select({
      daily_calories: users.daily_calories,
      daily_protein: users.daily_protein,
    }).from(users).where(eq(users.id, req.user.id));

    const targets = userResult[0];
    const calorieTarget = Math.round(parseFloat(targets.daily_calories) || 0);
    const proteinTarget = Math.round(parseFloat(targets.daily_protein) || 0);

    res.status(200).json({
      success: true,
      date: today,
      foods: rows,
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

const getFoodHistory = async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        ROUND(SUM(calories)::numeric, 2) AS total_calories,
        ROUND(SUM(protein)::numeric, 2)  AS total_protein,
        COUNT(*) AS food_count
      FROM foods
      WHERE user_id = ${req.user.id}
      GROUP BY date
      ORDER BY date DESC
    `);

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

const getFoodByDate = async (req, res) => {
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  try {
    const result = await db.execute(sql`
      SELECT id, user_id, food_name, calories, protein, carbs, fats, quantity, unit, meal_type,
             TO_CHAR(date, 'YYYY-MM-DD') AS date, created_at
      FROM foods WHERE user_id = ${req.user.id} AND date = ${date} ORDER BY meal_type, created_at
    `);

    const userResult = await db.select({
      daily_calories: users.daily_calories,
      daily_protein: users.daily_protein,
    }).from(users).where(eq(users.id, req.user.id));

    const targets = userResult[0];
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
      calories: parseFloat(row.calories),
      protein:  parseFloat(row.protein),
      carbs:    parseFloat(row.carbs) || 0,
      fats:     parseFloat(row.fats)  || 0,
      category: row.meal_type,
    }));

    res.status(200).json({
      success: true,
      date,
      foods,
      summary: {
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
};

const updateFood = async (req, res) => {
  const { id } = req.params;
  const { food_name, calories, protein, carbs, fats, category, meal_type, date } = req.body;
  const rawMealType = meal_type || category || '';
  const newMealType = rawMealType.toLowerCase();

  try {
    const existing = await db.select().from(foods).where(and(eq(foods.id, id), eq(foods.user_id, req.user.id)));
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Food entry not found.' });
    }

    const current = existing[0];
    const result = await db.update(foods).set({
      food_name: food_name       ?? current.food_name,
      calories: parseFloat(calories ?? current.calories),
      protein: parseFloat(protein  ?? current.protein),
      carbs: parseFloat(carbs    ?? current.carbs),
      fats: parseFloat(fats     ?? current.fats),
      meal_type: newMealType     || current.meal_type,
      date: date            || current.date,
    }).where(and(eq(foods.id, id), eq(foods.user_id, req.user.id))).returning();

    res.status(200).json({
      success: true,
      message: 'Food entry updated.',
      food: result[0],
    });
  } catch (err) {
    console.error('Update food error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const deleteFood = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.delete(foods).where(and(eq(foods.id, id), eq(foods.user_id, req.user.id))).returning({ id: foods.id });
    if (result.length === 0) return res.status(404).json({ success: false, message: 'Food entry not found.' });
    res.status(200).json({ success: true, message: 'Food entry deleted.' });
  } catch (err) {
    console.error('Delete food error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { addFood, getTodayFood, getFoodHistory, getFoodByDate, updateFood, deleteFood };
