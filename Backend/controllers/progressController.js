// ============================================================
// controllers/progressController.js
// ============================================================
// DEFICIT DEFINITION (consistent everywhere):
//
//   For weight_loss:
//     actual_deficit = target_calories - consumed_calories
//     (positive = calories saved below target → good)
//
//   For weight_gain:
//     actual_deficit = consumed_calories - target_calories
//     (positive = calories eaten above target → good)
//
//   target_calories is already maintenance ± 500 (from calculateMetrics).
//   We NEVER add 500 a second time anywhere.
//
//   Weight change estimate:  deficit_kcal / 7700 = kg changed
// ============================================================

const pool               = require('../config/db');
const { calculateMetrics } = require('../utils/metrics');

// ── Date helpers ─────────────────────────────────────────────

function getWeekDateRange(date = new Date()) {
  const d    = new Date(date);
  const day  = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end:   sunday.toISOString().split('T')[0],
  };
}

function getLastWeekDateRange(date = new Date()) {
  const d         = new Date(date);
  const day       = d.getDay();
  const diff      = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(d);
  thisMonday.setDate(d.getDate() - diff);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  return {
    start: lastMonday.toISOString().split('T')[0],
    end:   lastSunday.toISOString().split('T')[0],
  };
}

// ── Internal: log today's calories for a user ─────────────────

async function logTodayForUser(userId) {
  const userResult = await pool.query(
    'SELECT id, daily_calories, goal FROM users WHERE id = $1',
    [userId]
  );
  if (userResult.rows.length === 0) return;
  const user = userResult.rows[0];
  if (!['weight_loss', 'weight_gain'].includes(user.goal)) return;

  const today = new Date().toISOString().split('T')[0];

  const foodResult = await pool.query(
    `SELECT COALESCE(SUM(calories), 0)::float AS total_calories
     FROM foods WHERE user_id = $1 AND date = $2`,
    [userId, today]
  );
  const consumed = Math.round(parseFloat(foodResult.rows[0].total_calories) || 0);

  // KEY FIX: if no food logged today yet, delete any stale zero-calorie row
  // and return early. A consumed=0 row creates a phantom +target deficit
  // (e.g. +1334) that inflates the weekly total even though the day is not over.
  if (consumed === 0) {
    await pool.query(
      `DELETE FROM daily_calorie_tracking
       WHERE user_id = $1 AND date = $2 AND consumed_calories = 0`,
      [userId, today]
    );
    return;
  }

  const target    = Math.round(parseFloat(user.daily_calories) || 0);
  const remaining = target - consumed;
  const actualDeficit = user.goal === 'weight_loss' ? remaining : consumed - target;

  await pool.query(
    `INSERT INTO daily_calorie_tracking
       (user_id, date, target_calories, consumed_calories, remaining_calories, actual_deficit)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, date) DO UPDATE SET
       target_calories    = EXCLUDED.target_calories,
       consumed_calories  = EXCLUDED.consumed_calories,
       remaining_calories = EXCLUDED.remaining_calories,
       actual_deficit     = EXCLUDED.actual_deficit`,
    [userId, today, target, consumed, remaining, actualDeficit]
  );
}

// ── Internal: weekly automatic weight recalculation ──────────

async function applyWeeklyUpdateForUser(userId) {
  const userResult = await pool.query(
    'SELECT id, weight, goal, height, age, gender, activity_level, gym_status FROM users WHERE id = $1',
    [userId]
  );
  if (userResult.rows.length === 0) return;
  const user = userResult.rows[0];
  if (!['weight_loss', 'weight_gain'].includes(user.goal)) return;

  const { start: weekStart, end: weekEnd } = getLastWeekDateRange();

  // Prevent duplicate weekly entries
  const existing = await pool.query(
    'SELECT id FROM weight_history WHERE user_id = $1 AND week_start = $2',
    [userId, weekStart]
  );
  if (existing.rows.length > 0) return;

  // Sum actual_deficit for the week
  // actual_deficit already reflects the real calorie deficit/surplus
  // (no further +500 adjustment needed)
  const deficitResult = await pool.query(
    `SELECT COALESCE(SUM(actual_deficit), 0)::float AS total,
            COUNT(*)::int AS days
     FROM daily_calorie_tracking
     WHERE user_id = $1 AND date >= $2 AND date <= $3`,
    [userId, weekStart, weekEnd]
  );
  const weeklyDeficit = parseFloat(deficitResult.rows[0].total) || 0;

  // Weight change: deficit / 7700
  const weightChange = weeklyDeficit / 7700;
  const oldWeight    = parseFloat(user.weight);
  let   newWeight;
  if (user.goal === 'weight_loss') {
    newWeight = oldWeight - weightChange;
  } else {
    newWeight = oldWeight + weightChange;
  }
  newWeight = Math.round(newWeight * 100) / 100;
  const signedChange = parseFloat((newWeight - oldWeight).toFixed(2));

  await pool.query(
    `INSERT INTO weight_history
       (user_id, week_start, week_end, old_weight, new_weight, weekly_calories, weight_change, goal)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [userId, weekStart, weekEnd, oldWeight, newWeight, Math.round(weeklyDeficit), signedChange, user.goal]
  );

  await pool.query('UPDATE users SET weight = $1, updated_at = NOW() WHERE id = $2', [newWeight, userId]);

  const { bmr, maintenance_calories, daily_calories, daily_protein } = calculateMetrics(
    newWeight, user.height, user.age, user.gender, user.activity_level, user.goal, user.gym_status
  );
  await pool.query(
    'UPDATE users SET bmr = $1, daily_calories = $2, daily_protein = $3 WHERE id = $4',
    [bmr, daily_calories, daily_protein, userId]
  );
}

// ── GET /api/progress/weekly ──────────────────────────────────

const getWeeklyProgress = async (req, res) => {
  try {
    const userId = req.user.id;

    // Refresh today's tracking row
    await logTodayForUser(userId);

    // Auto-apply weekly update on Mondays
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 1) {
      await applyWeeklyUpdateForUser(userId);
    }

    const week = getWeekDateRange();

    // Backfill any day this week that has food data but no tracking row
    const userRow = await pool.query(
      'SELECT daily_calories, goal FROM users WHERE id = $1',
      [userId]
    );
    if (userRow.rows.length > 0) {
      const u = userRow.rows[0];
      const existingDates = await pool.query(
        `SELECT to_char(date, 'YYYY-MM-DD') AS ds
         FROM daily_calorie_tracking
         WHERE user_id = $1 AND date >= $2 AND date <= $3`,
        [userId, week.start, week.end]
      );
      const existingSet = new Set(existingDates.rows.map(r => r.ds));
      const weekStart   = new Date(week.start + 'T12:00:00');  // noon avoids DST/UTC shifts
      const weekEnd     = new Date(week.end   + 'T12:00:00');
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        // Format as YYYY-MM-DD using local year/month/day to avoid UTC offset shifting date back
        const ds = [
          d.getFullYear(),
          String(d.getMonth() + 1).padStart(2, '0'),
          String(d.getDate()).padStart(2, '0'),
        ].join('-');
        if (existingSet.has(ds)) continue;
        const foodResult = await pool.query(
          `SELECT COALESCE(SUM(calories), 0)::float AS total_calories
           FROM foods WHERE user_id = $1 AND date = $2`,
          [userId, ds]
        );
        const consumed = Math.round(parseFloat(foodResult.rows[0].total_calories) || 0);
        if (consumed === 0) continue;
        const target    = Math.round(parseFloat(u.daily_calories) || 0);
        const remaining = target - consumed;
        const actualDeficit = u.goal === 'weight_loss' ? remaining : consumed - target;
        await pool.query(
          `INSERT INTO daily_calorie_tracking
             (user_id, date, target_calories, consumed_calories, remaining_calories, actual_deficit)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id, date) DO UPDATE SET
             target_calories    = EXCLUDED.target_calories,
             consumed_calories  = EXCLUDED.consumed_calories,
             remaining_calories = EXCLUDED.remaining_calories,
             actual_deficit     = EXCLUDED.actual_deficit`,
          [userId, ds, target, consumed, remaining, actualDeficit]
        );
      }
    }

    // Current week daily rows — TO_CHAR ensures plain 'YYYY-MM-DD' string,
    // preventing the pg driver from returning a JS Date object that serialises
    // as e.g. "2026-06-21T18:30:00.000Z" (UTC offset for IST users).
    const daysResult = await pool.query(
      `SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date,
              target_calories, consumed_calories, remaining_calories, actual_deficit
       FROM daily_calorie_tracking
       WHERE user_id = $1 AND date >= $2 AND date <= $3
       ORDER BY date ASC`,
      [userId, week.start, week.end]
    );

    // Sum deficit for this week directly (no +500 multiplier)
    const currentDeficit = daysResult.rows.reduce(
      (sum, r) => sum + parseFloat(r.actual_deficit || 0), 0
    );

    const userResult = await pool.query(
      'SELECT weight, target_weight, goal, daily_calories FROM users WHERE id = $1',
      [userId]
    );
    const user          = userResult.rows[0];
    const currentWeight = parseFloat(user.weight) || 0;
    const targetWeight  = user.target_weight ? parseFloat(user.target_weight) : null;
    // Weight remaining: how far from target (sign reflects direction)
    const remainingWeight = targetWeight !== null
      ? parseFloat((targetWeight - currentWeight).toFixed(2))
      : null;

    // Estimated weight at end of this week
    let estimatedNextMonday = null;
    if (currentDeficit !== 0 && user.goal !== 'maintain') {
      const daysLogged   = daysResult.rows.length;
      const daysLeft     = 7 - daysLogged;
      const avgDaily     = daysLogged > 0 ? currentDeficit / daysLogged : 0;
      // Full maintenance deficit = actual_deficit + 500 per day for all 7 days
      const projTotal    = currentDeficit + avgDaily * daysLeft + 500 * 7;
      const estChange    = projTotal / 7700;
      estimatedNextMonday = user.goal === 'weight_loss'
        ? parseFloat((currentWeight - estChange).toFixed(2))
        : parseFloat((currentWeight + estChange).toFixed(2));
    }

    // Last week summary
    const lastWeek = getLastWeekDateRange();
    const lastWeekResult = await pool.query(
      `SELECT COALESCE(SUM(actual_deficit), 0)::float AS total_deficit,
              COUNT(*)::int AS days
       FROM daily_calorie_tracking
       WHERE user_id = $1 AND date >= $2 AND date <= $3`,
      [userId, lastWeek.start, lastWeek.end]
    );
    const lastWeekDeficit     = Math.round(parseFloat(lastWeekResult.rows[0].total_deficit) || 0);
    const lastWeekWeightChange = parseFloat((lastWeekDeficit / 7700).toFixed(2));

    // Latest weight_history record — TO_CHAR prevents UTC Date object serialisation
    const latestHistory = await pool.query(
      `SELECT TO_CHAR(week_start, 'YYYY-MM-DD') AS week_start,
              TO_CHAR(week_end,   'YYYY-MM-DD') AS week_end,
              old_weight, new_weight, weekly_calories, weight_change
       FROM weight_history
       WHERE user_id = $1
       ORDER BY week_start DESC
       LIMIT 1`,
      [userId]
    );

    // ── After-last-update report ──────────────────────────────
    let previousWeight        = null;
    let lastUpdateDeficit     = null;
    let lastUpdateWeightChange = null;
    let lastWeightUpdateDate  = null;
    let afterUpdateDeficit    = 0;
    let daysSinceUpdate       = 0;
    let predictedWeight       = null;
    let weightChange          = null;

    if (latestHistory.rows.length > 0) {
      const lu               = latestHistory.rows[0];
      lastWeightUpdateDate   = lu.week_end;
      previousWeight         = parseFloat(lu.old_weight);
      lastUpdateDeficit      = parseInt(lu.weekly_calories);
      lastUpdateWeightChange = parseFloat(lu.weight_change);

      // Calories accumulated AFTER the last update date
      const afterResult = await pool.query(
        `SELECT COALESCE(SUM(actual_deficit), 0)::float AS total,
                COUNT(*)::int AS days
         FROM daily_calorie_tracking
         WHERE user_id = $1 AND date > $2`,
        [userId, lastWeightUpdateDate]
      );
      const afterRow = afterResult.rows[0];
      afterUpdateDeficit = Math.round(parseFloat(afterRow.total) || 0);
      const afterDays    = afterRow.days || 0;

      daysSinceUpdate = Math.max(0, Math.floor(
        (Date.now() - new Date(lastWeightUpdateDate).getTime()) / (1000 * 60 * 60 * 24)
      ));

      // Predicted weight based on full maintenance deficit (actual_deficit + 500 per tracked day)
      const fullAfterDeficit = afterUpdateDeficit + 500 * afterDays;
      const estChange = fullAfterDeficit / 7700;
      if (user.goal === 'weight_loss') {
        predictedWeight = parseFloat((currentWeight - estChange).toFixed(2));
      } else if (user.goal === 'weight_gain') {
        predictedWeight = parseFloat((currentWeight + estChange).toFixed(2));
      }

      // Weight change since last update
      weightChange = parseFloat((currentWeight - previousWeight).toFixed(2));
    }

    res.status(200).json({
      success: true,
      progress: {
        currentWeight,
        targetWeight,
        remainingWeight,
        currentWeeklyDeficit: Math.round(currentDeficit),
        lastWeekDeficit,
        lastWeekWeightChange,
        estimatedNextMonday,
        // After-last-update fields
        previousWeight,
        lastUpdateDeficit,
        lastUpdateWeightChange,
        lastWeightUpdateDate,
        afterUpdateDeficit,
        daysSinceUpdate,
        predictedWeight,
        weightChange,
        days: daysResult.rows.map(r => ({
          date:             r.date,
          targetCalories:   r.target_calories,
          consumedCalories: Math.round(parseFloat(r.consumed_calories) || 0),
          remainingCalories:Math.round(parseFloat(r.remaining_calories) || 0),
          actualDeficit:    Math.round(parseFloat(r.actual_deficit) || 0),
        })),
        latestWeightHistory: latestHistory.rows[0] || null,
      },
    });
  } catch (err) {
    console.error('Get weekly progress error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── GET /api/progress/history ─────────────────────────────────

const getWeightHistory = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id,
              TO_CHAR(week_start, 'YYYY-MM-DD') AS week_start,
              TO_CHAR(week_end,   'YYYY-MM-DD') AS week_end,
              old_weight, new_weight, weekly_calories, weight_change, goal, created_at
       FROM weight_history
       WHERE user_id = $1
       ORDER BY week_start DESC
       LIMIT 20`,
      [req.user.id]
    );
    res.status(200).json({
      success: true,
      history: result.rows.map(r => ({
        ...r,
        old_weight:      parseFloat(r.old_weight),
        new_weight:      parseFloat(r.new_weight),
        weekly_calories: parseInt(r.weekly_calories),
        weight_change:   parseFloat(r.weight_change),
      })),
    });
  } catch (err) {
    console.error('Get weight history error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── POST /api/progress/log-today ──────────────────────────────

const logToday = async (req, res) => {
  try {
    await logTodayForUser(req.user.id);
    res.status(200).json({ success: true, message: 'Today logged.' });
  } catch (err) {
    console.error('Log today error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── POST /api/progress/apply-weekly  (manual "Update Weight") ─
// Called when the user clicks "Update Weight" in the UI.
// Behaviour:
//   1. Snapshot current deficit → weight_history
//   2. Recalculate weight + targets based on new weight
//   3. Reset tracking cycle (future deficits start fresh from today)

const applyUpdate = async (req, res) => {
  try {
    const userId = req.user.id;

    const userResult = await pool.query(
      'SELECT id, weight, goal, height, age, gender, activity_level, gym_status FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const user = userResult.rows[0];
    if (!['weight_loss', 'weight_gain'].includes(user.goal)) {
      return res.status(200).json({ success: true, message: 'Maintain goal — no weight change applied.' });
    }

    // Find the last update date so we only sum deficit accumulated since then
    const lastHist = await pool.query(
      `SELECT TO_CHAR(week_end, 'YYYY-MM-DD') AS week_end
       FROM weight_history WHERE user_id = $1 ORDER BY week_end DESC LIMIT 1`,
      [userId]
    );
    const sinceDate = lastHist.rows.length > 0 ? lastHist.rows[0].week_end : '1970-01-01';

    // Sum actual_deficit accumulated since the last update
    const deficitResult = await pool.query(
      `SELECT COALESCE(SUM(actual_deficit), 0)::float AS total,
              TO_CHAR(MIN(date), 'YYYY-MM-DD') AS first_date,
              TO_CHAR(MAX(date), 'YYYY-MM-DD') AS last_date,
              COUNT(*)::int AS days
       FROM daily_calorie_tracking
       WHERE user_id = $1 AND date > $2`,
      [userId, sinceDate]
    );
    const row           = deficitResult.rows[0];
    const totalDeficit  = parseFloat(row.total) || 0;

    const today = new Date().toISOString().split('T')[0];

    // Full maintenance deficit = actual_deficit + 500 per day (target already has -500 built in)
    const fullDeficit   = totalDeficit + 500 * row.days;
    const weightChange  = fullDeficit / 7700;
    const oldWeight     = parseFloat(user.weight);
    let   newWeight;
    if (user.goal === 'weight_loss') {
      newWeight = oldWeight - weightChange;
    } else {
      newWeight = oldWeight + weightChange;
    }
    newWeight = Math.round(newWeight * 100) / 100;
    const signedChange = parseFloat((newWeight - oldWeight).toFixed(2));

    // Save snapshot to weight_history
    await pool.query(
      `INSERT INTO weight_history
         (user_id, week_start, week_end, old_weight, new_weight, weekly_calories, weight_change, goal)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        row.first_date || today,
        today,
        oldWeight,
        newWeight,
        Math.round(fullDeficit),
        signedChange,
        user.goal,
      ]
    );

    // Update user weight and recalculate all targets
    const { bmr, maintenance_calories, daily_calories, daily_protein } = calculateMetrics(
      newWeight, user.height, user.age, user.gender, user.activity_level, user.goal, user.gym_status
    );
    await pool.query(
      `UPDATE users SET
         weight         = $1,
         bmr            = $2,
         daily_calories = $3,
         daily_protein  = $4,
         updated_at     = NOW()
       WHERE id = $5`,
      [newWeight, bmr, daily_calories, daily_protein, userId]
    );

    // Log a fresh tracking row for today using the NEW targets so the new cycle starts at 0
    const todayFood = await pool.query(
      `SELECT COALESCE(SUM(calories), 0)::float AS total FROM foods WHERE user_id = $1 AND date = $2`,
      [userId, today]
    );
    const todayConsumed  = Math.round(parseFloat(todayFood.rows[0].total) || 0);
    const newTarget      = Math.round(daily_calories);
    const newRemaining   = newTarget - todayConsumed;
    const newDayDeficit  = user.goal === 'weight_loss' ? newRemaining : todayConsumed - newTarget;
    await pool.query(
      `INSERT INTO daily_calorie_tracking
         (user_id, date, target_calories, consumed_calories, remaining_calories, actual_deficit)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, date) DO UPDATE SET
         target_calories    = EXCLUDED.target_calories,
         consumed_calories  = EXCLUDED.consumed_calories,
         remaining_calories = EXCLUDED.remaining_calories,
         actual_deficit     = EXCLUDED.actual_deficit`,
      [userId, today, newTarget, todayConsumed, newRemaining, newDayDeficit]
    );

    res.status(200).json({
      success: true,
      message: 'Weight updated successfully.',
      data: {
        oldWeight,
        newWeight,
        totalDeficit:   Math.round(totalDeficit),
        weightChange:   signedChange,
        bmr,
        maintenance_calories,
        daily_calories,
        daily_protein,
        lastDate:       today,
      },
    });
  } catch (err) {
    console.error('Apply update error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getWeeklyProgress, getWeightHistory, logToday, applyUpdate };