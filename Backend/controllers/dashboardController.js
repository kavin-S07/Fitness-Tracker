const pool = require('../config/db');

// ============================================
// GET /api/dashboard
// Home dashboard - today's summary + weekly overview
// ============================================
const getDashboard = async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  try {
    // 1. User profile (targets)
    const userResult = await pool.query(
      'SELECT name, weight, target_weight, goal, daily_calories, daily_protein FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = userResult.rows[0];

    // 2. Today's food totals
    // BUG FIX: Use COALESCE in SQL to guarantee numeric 0 instead of null,
    // then parse to float in JS for safe arithmetic.
    const foodResult = await pool.query(
      `SELECT 
        COALESCE(SUM(calories), 0)::float AS total_calories,
        COALESCE(SUM(protein), 0)::float  AS total_protein
       FROM foods WHERE user_id = $1 AND date = $2`,
      [req.user.id, today]
    );
    const todayFood = foodResult.rows[0];
    const caloriesConsumed = parseFloat(todayFood.total_calories) || 0;
    const proteinConsumed = parseFloat(todayFood.total_protein) || 0;
    const caloriesTarget = parseFloat(user.daily_calories) || 0;
    const proteinTarget = parseFloat(user.daily_protein) || 0;

    // 3. Today's workout summary
    // BUG FIX: Use COALESCE on STRING_AGG to avoid null when no workouts exist.
    const workoutResult = await pool.query(
      `SELECT 
        COUNT(wl.id)::int                                        AS total_sets,
        COALESCE(STRING_AGG(DISTINCT e.exercise_type, ', '), 'None') AS muscle_groups
       FROM workout_logs wl
       JOIN exercise e ON wl.exercise_id = e.id
       WHERE wl.user_id = $1 AND wl.workout_date = $2`,
      [req.user.id, today]
    );
    const todayWorkout = workoutResult.rows[0];

    // 4. Last 7 days food history (for chart)
    const weekFoodResult = await pool.query(
      `SELECT 
        date,
        ROUND(SUM(calories)::numeric, 2)::float AS calories,
        ROUND(SUM(protein)::numeric, 2)::float  AS protein
       FROM foods WHERE user_id = $1 AND date >= NOW() - INTERVAL '7 days'
       GROUP BY date ORDER BY date ASC`,
      [req.user.id]
    );

    // 5. Last 7 days workout history
    const weekWorkoutResult = await pool.query(
      `SELECT 
        workout_date,
        COUNT(id)::int  AS total_sets,
        SUM(sets)::int  AS total_volume
       FROM workout_logs WHERE user_id = $1 AND workout_date >= NOW() - INTERVAL '7 days'
       GROUP BY workout_date ORDER BY workout_date ASC`,
      [req.user.id]
    );

    // 6. Latest weight log
    const weightResult = await pool.query(
      'SELECT weight, log_date FROM weight_logs WHERE user_id = $1 ORDER BY log_date DESC LIMIT 1',
      [req.user.id]
    );

    res.status(200).json({
      success: true,
      dashboard: {
        user: {
          name: user.name,
          current_weight: parseFloat(weightResult.rows[0]?.weight || user.weight) || 0,
          target_weight: parseFloat(user.target_weight) || null,
          goal: user.goal,
          daily_calories_target: Math.round(caloriesTarget),
          daily_protein_target: Math.round(proteinTarget),
        },
        today: {
          date: today,
          calories_consumed: Math.round(caloriesConsumed),
          protein_consumed: Math.round(proteinConsumed),
          calories_remaining: Math.round(caloriesTarget - caloriesConsumed),
          protein_remaining: Math.round(proteinTarget - proteinConsumed),
          workout_sets: todayWorkout.total_sets || 0,
          muscle_groups_trained: todayWorkout.muscle_groups,
        },
        weekly_food_chart: weekFoodResult.rows,
        weekly_workout_chart: weekWorkoutResult.rows,
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ============================================
// GET /api/report/weekly
// Full weekly report (last 7 days analysis)
// ============================================
const getWeeklyReport = async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT name, weight, target_weight, goal, daily_calories, daily_protein FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = userResult.rows[0];

    // 2. Average calories & protein this week
    const foodAvgResult = await pool.query(
      `SELECT 
        COALESCE(AVG(daily_calories), 0)::float AS avg_calories,
        COALESCE(AVG(daily_protein), 0)::float  AS avg_protein,
        COUNT(DISTINCT date)::int               AS days_logged
       FROM (
         SELECT date,
           SUM(calories) AS daily_calories,
           SUM(protein)  AS daily_protein
         FROM foods
         WHERE user_id = $1 AND date >= NOW() - INTERVAL '7 days'
         GROUP BY date
       ) daily_totals`,
      [req.user.id]
    );
    const foodAvg = foodAvgResult.rows[0];

    // 3. Workout consistency this week
    // BUG FIX: Original query referenced wl.sets in SUM without proper aliasing.
    // Renamed to clarify: total_sets = sum of the sets column (volume),
    // total_entries = count of log rows.
    const workoutConsistencyResult = await pool.query(
      `SELECT 
        COUNT(DISTINCT wl.workout_date)::int                              AS workout_days,
        COALESCE(SUM(wl.sets), 0)::int                                    AS total_sets,
        COALESCE(STRING_AGG(DISTINCT e.exercise_type, ', '), 'None')      AS muscle_groups_trained
       FROM workout_logs wl
       JOIN exercise e ON wl.exercise_id = e.id
       WHERE wl.user_id = $1 AND wl.workout_date >= NOW() - INTERVAL '7 days'`,
      [req.user.id]
    );
    const workoutConsistency = workoutConsistencyResult.rows[0];

    // 4. Weight change this week
    const weightChangeResult = await pool.query(
      `SELECT 
        MIN(weight)::float AS min_weight,
        MAX(weight)::float AS max_weight,
        (SELECT weight FROM weight_logs WHERE user_id = $1 AND log_date >= NOW() - INTERVAL '7 days' ORDER BY log_date ASC  LIMIT 1)::float AS start_weight,
        (SELECT weight FROM weight_logs WHERE user_id = $1 AND log_date >= NOW() - INTERVAL '7 days' ORDER BY log_date DESC LIMIT 1)::float AS end_weight
       FROM weight_logs
       WHERE user_id = $1 AND log_date >= NOW() - INTERVAL '7 days'`,
      [req.user.id]
    );
    const weightChange = weightChangeResult.rows[0];

    // 5. Strongest muscle group (most sets this week)
    const strongestMuscleResult = await pool.query(
      `SELECT e.exercise_type, SUM(wl.sets)::int AS total_sets
       FROM workout_logs wl
       JOIN exercise e ON wl.exercise_id = e.id
       WHERE wl.user_id = $1 AND wl.workout_date >= NOW() - INTERVAL '7 days'
       GROUP BY e.exercise_type
       ORDER BY total_sets DESC
       LIMIT 1`,
      [req.user.id]
    );

    // Build weight-change diff
    const weightDiff =
      weightChange.end_weight !== null && weightChange.start_weight !== null
        ? (
            parseFloat(weightChange.end_weight) - parseFloat(weightChange.start_weight)
          ).toFixed(1)
        : null;

    let progressStatus = '⚪ No weight data available';
    if (weightDiff !== null) {
      if (user.goal === 'weight_loss' && parseFloat(weightDiff) < 0)
        progressStatus = '✅ On track with weight loss goal!';
      else if (user.goal === 'weight_gain' && parseFloat(weightDiff) > 0)
        progressStatus = '✅ On track with weight gain goal!';
      else if (user.goal === 'maintain' && Math.abs(parseFloat(weightDiff)) < 0.5)
        progressStatus = '✅ Weight is maintained well!';
      else progressStatus = '⚠️ Not aligned with goal — review your diet';
    }

    res.status(200).json({
      success: true,
      report: {
        week_summary: {
          start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
        },
        nutrition: {
          avg_daily_calories: Math.round(parseFloat(foodAvg.avg_calories) || 0),
          avg_daily_protein: Math.round(parseFloat(foodAvg.avg_protein) || 0),
          days_food_logged: foodAvg.days_logged || 0,
          calorie_target: Math.round(parseFloat(user.daily_calories) || 0),
          protein_target: Math.round(parseFloat(user.daily_protein) || 0),
        },
        workout: {
          workout_days: workoutConsistency.workout_days || 0,
          total_sets: workoutConsistency.total_sets || 0,
          muscle_groups_trained: workoutConsistency.muscle_groups_trained,
          strongest_muscle: strongestMuscleResult.rows[0]?.exercise_type || 'N/A',
          missed_days: 7 - (workoutConsistency.workout_days || 0),
        },
        weight: {
          start_weight: parseFloat(weightChange.start_weight) || parseFloat(user.weight) || null,
          end_weight: parseFloat(weightChange.end_weight) || parseFloat(user.weight) || null,
          change: weightDiff !== null ? parseFloat(weightDiff) : null,
          target_weight: parseFloat(user.target_weight) || null,
          progress_status: progressStatus,
        },
      },
    });
  } catch (err) {
    console.error('Weekly report error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ============================================
// POST /api/weight/log
// Log today's body weight
// ============================================
const logWeight = async (req, res) => {
  const { weight, date } = req.body;

  // BUG FIX: Validate weight is provided and is a positive number
  if (weight === undefined || weight === null) {
    return res.status(400).json({ success: false, message: 'weight is required.' });
  }
  const parsedWeight = parseFloat(weight);
  if (isNaN(parsedWeight) || parsedWeight <= 0) {
    return res.status(400).json({ success: false, message: 'weight must be a positive number.' });
  }

  // BUG FIX: Validate date format if provided
  const logDate = date || new Date().toISOString().split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid date format. Use YYYY-MM-DD.',
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO weight_logs (user_id, weight, log_date)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, log_date) DO UPDATE SET weight = EXCLUDED.weight
       RETURNING *`,
      [req.user.id, parsedWeight, logDate]
    );

    await pool.query('UPDATE users SET weight = $1, updated_at = NOW() WHERE id = $2', [
      parsedWeight,
      req.user.id,
    ]);

    res.status(201).json({
      success: true,
      message: 'Weight logged successfully!',
      log: result.rows[0],
    });
  } catch (err) {
    console.error('Log weight error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ============================================
// GET /api/weight/history
// Get weight log history (last 30 days)
// ============================================
const getWeightHistory = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        weight::float AS weight,
        log_date
       FROM weight_logs
       WHERE user_id = $1 AND log_date >= NOW() - INTERVAL '30 days'
       ORDER BY log_date ASC`,
      [req.user.id]
    );

    // BUG FIX: Ensure weight values are numbers, not strings
    const history = result.rows.map((row) => ({
      weight: parseFloat(row.weight),
      log_date: row.log_date,
    }));

    res.status(200).json({
      success: true,
      history,
    });
  } catch (err) {
    console.error('Get weight history error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getDashboard, getWeeklyReport, logWeight, getWeightHistory };
