const { db } = require('../db');
const { users } = require('../db/schema');
const { eq, sql } = require('drizzle-orm');
const { calculateMetrics } = require('../utils/metrics');

const getDashboard = async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  try {
    const userResult = await db.select({
      name: users.name, weight: users.weight, target_weight: users.target_weight,
      goal: users.goal, daily_calories: users.daily_calories, daily_protein: users.daily_protein,
      bmr: users.bmr, height: users.height, age: users.age, gender: users.gender,
      activity_level: users.activity_level, gym_status: users.gym_status,
    }).from(users).where(eq(users.id, req.user.id));

    if (userResult.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const user = userResult[0];

    const { bmr, maintenance_calories, daily_calories, daily_protein } = calculateMetrics(
      user.weight, user.height, user.age, user.gender,
      user.activity_level, user.goal, user.gym_status
    );

    const foodResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(calories), 0)::float AS total_calories,
        COALESCE(SUM(protein),  0)::float AS total_protein
      FROM foods WHERE user_id = ${req.user.id} AND date = ${today}
    `);
    const todayFood        = foodResult.rows[0];
    const caloriesConsumed = parseFloat(todayFood.total_calories) || 0;
    const proteinConsumed  = parseFloat(todayFood.total_protein)  || 0;
    const caloriesTarget   = daily_calories;
    const proteinTarget    = daily_protein;

    const workoutResult = await db.execute(sql`
      SELECT
        COUNT(wl.id)::int                                            AS total_sets,
        COALESCE(STRING_AGG(DISTINCT e.exercise_type, ', '), 'None') AS muscle_groups
      FROM workout_logs wl
      JOIN exercise e ON wl.exercise_id = e.id
      WHERE wl.user_id = ${req.user.id} AND wl.workout_date = ${today}
    `);
    const todayWorkout = workoutResult.rows[0];

    const weekFoodResult = await db.execute(sql`
      SELECT
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        ROUND(SUM(calories)::numeric, 2)::float AS calories,
        ROUND(SUM(protein)::numeric,  2)::float AS protein
      FROM foods WHERE user_id = ${req.user.id} AND date >= NOW() - INTERVAL '7 days'
      GROUP BY date ORDER BY date ASC
    `);

    const weekWorkoutResult = await db.execute(sql`
      SELECT
        TO_CHAR(workout_date, 'YYYY-MM-DD') AS workout_date,
        COUNT(id)::int AS total_sets,
        SUM(sets)::int AS total_volume
      FROM workout_logs WHERE user_id = ${req.user.id} AND workout_date >= NOW() - INTERVAL '7 days'
      GROUP BY workout_date ORDER BY workout_date ASC
    `);

    const weightResult = await db.execute(sql`
      SELECT weight, TO_CHAR(log_date, 'YYYY-MM-DD') AS log_date
      FROM weight_logs WHERE user_id = ${req.user.id} ORDER BY log_date DESC LIMIT 1
    `);
    const currentWeight = parseFloat(weightResult.rows[0]?.weight || user.weight) || 0;

    const heightM = parseFloat(user.height) / 100;
    const bmi     = heightM > 0
      ? parseFloat((currentWeight / (heightM * heightM)).toFixed(1))
      : null;

    const targetWeight    = user.target_weight ? parseFloat(user.target_weight) : null;
    const weightRemaining = targetWeight !== null
      ? parseFloat((targetWeight - currentWeight).toFixed(2))
      : null;

    res.status(200).json({
      success: true,
      dashboard: {
        user: {
          name:                  user.name,
          current_weight:        currentWeight,
          target_weight:         targetWeight,
          goal:                  user.goal,
          daily_calories_target: caloriesTarget,
          daily_protein_target:  proteinTarget,
          bmr,
          maintenance_calories,
          bmi,
          weight_remaining:      weightRemaining,
        },
        today: {
          date:                  today,
          calories_consumed:     Math.round(caloriesConsumed),
          protein_consumed:      Math.round(proteinConsumed),
          calories_remaining:    Math.round(caloriesTarget - caloriesConsumed),
          protein_remaining:     Math.round(proteinTarget  - proteinConsumed),
          workout_sets:          todayWorkout.total_sets || 0,
          muscle_groups_trained: todayWorkout.muscle_groups,
        },
        weekly_food_chart:    weekFoodResult.rows,
        weekly_workout_chart: weekWorkoutResult.rows,
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getWeeklyReport = async (req, res) => {
  try {
    const userResult = await db.select({
      name: users.name, weight: users.weight, target_weight: users.target_weight,
      goal: users.goal, daily_calories: users.daily_calories, daily_protein: users.daily_protein,
      bmr: users.bmr, height: users.height, age: users.age, gender: users.gender,
      activity_level: users.activity_level, gym_status: users.gym_status,
    }).from(users).where(eq(users.id, req.user.id));

    if (userResult.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const user          = userResult[0];
    const currentWeight = parseFloat(user.weight) || 0;

    const { bmr, maintenance_calories, daily_calories, daily_protein } = calculateMetrics(
      user.weight, user.height, user.age, user.gender,
      user.activity_level, user.goal, user.gym_status
    );

    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const today     = new Date().toISOString().split('T')[0];

    const deficitResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(consumed_calories), 0)::float AS total_consumed,
        COALESCE(SUM(target_calories),   0)::float AS total_target,
        COALESCE(SUM(actual_deficit),    0)::float AS total_deficit,
        COUNT(*)::int                              AS days_tracked
      FROM daily_calorie_tracking
      WHERE user_id = ${req.user.id} AND date >= ${weekStart} AND date <= ${today}
    `);
    const def           = deficitResult.rows[0];
    const totalConsumed = Math.round(parseFloat(def.total_consumed) || 0);
    const totalDeficit  = Math.round(parseFloat(def.total_deficit)  || 0);
    const daysTracked   = def.days_tracked || 0;
    const avgConsumed   = daysTracked > 0 ? Math.round(totalConsumed / daysTracked) : 0;
    const avgDeficit    = daysTracked > 0 ? Math.round(totalDeficit  / daysTracked) : 0;

    const lastHistResult = await db.execute(sql`
      SELECT TO_CHAR(week_start, 'YYYY-MM-DD') AS week_start,
             TO_CHAR(week_end,   'YYYY-MM-DD') AS week_end,
             old_weight, new_weight, weekly_calories, weight_change
      FROM weight_history
      WHERE user_id = ${req.user.id}
      ORDER BY week_end DESC LIMIT 1
    `);
    const lastHist = lastHistResult.rows[0] || null;

    let afterUpdateDeficit = 0;
    let daysSinceUpdate    = 0;
    let estimatedWeight    = null;

    if (lastHist) {
      const afterResult = await db.execute(sql`
        SELECT COALESCE(SUM(actual_deficit), 0)::float AS total,
               COUNT(*)::int AS days
        FROM daily_calorie_tracking
        WHERE user_id = ${req.user.id} AND date > ${lastHist.week_end}
      `);
      const afterRow = afterResult.rows[0];
      afterUpdateDeficit = Math.round(parseFloat(afterRow.total) || 0);
      const afterDays    = afterRow.days || 0;
      daysSinceUpdate    = Math.max(0, Math.floor(
        (Date.now() - new Date(lastHist.week_end).getTime()) / (1000 * 60 * 60 * 24)
      ));
      const fullAfterDeficit = afterUpdateDeficit + 500 * afterDays;
      const estChange = fullAfterDeficit / 7700;
      if      (user.goal === 'weight_loss') estimatedWeight = parseFloat((currentWeight - estChange).toFixed(2));
      else if (user.goal === 'weight_gain') estimatedWeight = parseFloat((currentWeight + estChange).toFixed(2));
    }

    const workoutResult = await db.execute(sql`
      SELECT
        COUNT(DISTINCT wl.workout_date)::int                            AS workout_days,
        COALESCE(SUM(wl.sets), 0)::int                                  AS total_sets,
        COALESCE(STRING_AGG(DISTINCT e.exercise_type, ', '), 'None')    AS muscle_groups_trained
      FROM workout_logs wl
      JOIN exercise e ON wl.exercise_id = e.id
      WHERE wl.user_id = ${req.user.id} AND wl.workout_date >= NOW() - INTERVAL '7 days'
    `);
    const workoutConsistency = workoutResult.rows[0];

    const strongestResult = await db.execute(sql`
      SELECT e.exercise_type, SUM(wl.sets)::int AS total_sets
      FROM workout_logs wl
      JOIN exercise e ON wl.exercise_id = e.id
      WHERE wl.user_id = ${req.user.id} AND wl.workout_date >= NOW() - INTERVAL '7 days'
      GROUP BY e.exercise_type
      ORDER BY total_sets DESC LIMIT 1
    `);

    let progressStatus = '⚪ No weight data available';
    if (lastHist) {
      const change = parseFloat(lastHist.weight_change);
      if      (user.goal === 'weight_loss' && change < 0)                progressStatus = '✅ On track with weight loss goal!';
      else if (user.goal === 'weight_gain' && change > 0)                progressStatus = '✅ On track with weight gain goal!';
      else if (user.goal === 'maintain'    && Math.abs(change) < 0.5)    progressStatus = '✅ Weight is maintained well!';
      else                                                                 progressStatus = '⚠️ Not aligned with goal — review your diet';
    }

    const heightM = parseFloat(user.height) / 100;
    const bmi     = heightM > 0 ? parseFloat((currentWeight / (heightM * heightM)).toFixed(1)) : null;

    res.status(200).json({
      success: true,
      report: {
        week_summary: { start_date: weekStart, end_date: today },
        nutrition: {
          avg_daily_calories:  avgConsumed,
          avg_daily_deficit:   avgDeficit,
          total_deficit:       totalDeficit,
          calorie_target:      daily_calories,
          avg_daily_protein:   0,
          days_food_logged:    daysTracked,
          protein_target:      daily_protein,
        },
        workout: {
          workout_days:          workoutConsistency.workout_days || 0,
          total_sets:            workoutConsistency.total_sets   || 0,
          muscle_groups_trained: workoutConsistency.muscle_groups_trained,
          strongest_muscle:      strongestResult.rows[0]?.exercise_type || 'N/A',
          missed_days:           7 - (workoutConsistency.workout_days || 0),
        },
        weight: {
          current_weight:      currentWeight,
          start_weight:        lastHist ? parseFloat(lastHist.old_weight) : currentWeight,
          end_weight:          currentWeight,
          change:              lastHist ? parseFloat(lastHist.weight_change) : null,
          last_update_deficit: lastHist ? parseInt(lastHist.weekly_calories) : null,
          after_update_deficit:afterUpdateDeficit,
          days_since_update:   daysSinceUpdate,
          estimated_weight:    estimatedWeight,
          target_weight:       parseFloat(user.target_weight) || null,
          progress_status:     progressStatus,
          bmr,
          maintenance_calories,
          bmi,
        },
      },
    });
  } catch (err) {
    console.error('Weekly report error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const logWeight = async (req, res) => {
  const { weight, date } = req.body;

  if (weight === undefined || weight === null) {
    return res.status(400).json({ success: false, message: 'weight is required.' });
  }
  const parsedWeight = parseFloat(weight);
  if (isNaN(parsedWeight) || parsedWeight <= 0) {
    return res.status(400).json({ success: false, message: 'weight must be a positive number.' });
  }
  const logDate = date || new Date().toISOString().split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
    return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  try {
    const result = await db.execute(sql`
      INSERT INTO weight_logs (user_id, weight, log_date)
      VALUES (${req.user.id}, ${parsedWeight}, ${logDate})
      ON CONFLICT (user_id, log_date) DO UPDATE SET weight = EXCLUDED.weight
      RETURNING *
    `);

    const userRow = await db.select({
      height: users.height, age: users.age, gender: users.gender,
      activity_level: users.activity_level, goal: users.goal, gym_status: users.gym_status,
    }).from(users).where(eq(users.id, req.user.id));

    if (userRow.length > 0) {
      const u = userRow[0];
      const { bmr, maintenance_calories, daily_calories, daily_protein } = calculateMetrics(
        parsedWeight, u.height, u.age, u.gender, u.activity_level, u.goal, u.gym_status
      );

      await db.update(users).set({
        weight: parsedWeight,
        bmr,
        daily_calories,
        daily_protein,
        updated_at: new Date(),
      }).where(eq(users.id, req.user.id));

      return res.status(201).json({
        success: true,
        message: 'Weight logged and targets recalculated!',
        log: result.rows[0],
        recalculated: { bmr, maintenance_calories, daily_calories, daily_protein },
      });
    }

    await db.update(users).set({
      weight: parsedWeight,
      updated_at: new Date(),
    }).where(eq(users.id, req.user.id));

    res.status(201).json({ success: true, message: 'Weight logged.', log: result.rows[0] });
  } catch (err) {
    console.error('Log weight error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getWeightHistory = async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT weight::float AS weight, TO_CHAR(log_date, 'YYYY-MM-DD') AS log_date
      FROM weight_logs
      WHERE user_id = ${req.user.id} AND log_date >= NOW() - INTERVAL '30 days'
      ORDER BY log_date ASC
    `);

    res.status(200).json({
      success: true,
      history: result.rows.map(r => ({
        weight:   parseFloat(r.weight),
        log_date: r.log_date,
      })),
    });
  } catch (err) {
    console.error('Get weight history error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getDashboard, getWeeklyReport, logWeight, getWeightHistory };
