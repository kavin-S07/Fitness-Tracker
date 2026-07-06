const { db } = require('../db');
const { sql } = require('drizzle-orm');
const { calculateMetrics } = require('../utils/metrics');

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

async function logTodayForUser(userId) {
  const userResult = await db.execute(sql`
    SELECT id, daily_calories, goal FROM users WHERE id = ${userId}
  `);
  if (userResult.rows.length === 0) return;
  const user = userResult.rows[0];
  if (!['weight_loss', 'weight_gain'].includes(user.goal)) return;

  const today = new Date().toISOString().split('T')[0];

  const foodResult = await db.execute(sql`
    SELECT COALESCE(SUM(calories), 0)::float AS total_calories
    FROM foods WHERE user_id = ${userId} AND date = ${today}
  `);
  const consumed = Math.round(parseFloat(foodResult.rows[0].total_calories) || 0);

  if (consumed === 0) {
    await db.execute(sql`
      DELETE FROM daily_calorie_tracking
      WHERE user_id = ${userId} AND date = ${today} AND consumed_calories = 0
    `);
    return;
  }

  const target        = Math.round(parseFloat(user.daily_calories) || 0);
  const remaining     = target - consumed;
  const actualDeficit = user.goal === 'weight_loss' ? remaining : consumed - target;

  await db.execute(sql`
    INSERT INTO daily_calorie_tracking
      (user_id, date, target_calories, consumed_calories, remaining_calories, actual_deficit)
    VALUES (${userId}, ${today}, ${target}, ${consumed}, ${remaining}, ${actualDeficit})
    ON CONFLICT (user_id, date) DO UPDATE SET
      target_calories    = EXCLUDED.target_calories,
      consumed_calories  = EXCLUDED.consumed_calories,
      remaining_calories = EXCLUDED.remaining_calories,
      actual_deficit     = EXCLUDED.actual_deficit
  `);
}

async function applyWeeklyUpdateForUser(userId) {
  const userResult = await db.execute(sql`
    SELECT id, weight, goal, height, age, gender, activity_level, gym_status FROM users WHERE id = ${userId}
  `);
  if (userResult.rows.length === 0) return;
  const user = userResult.rows[0];
  if (!['weight_loss', 'weight_gain'].includes(user.goal)) return;

  const { start: weekStart, end: weekEnd } = getLastWeekDateRange();

  const existing = await db.execute(sql`
    SELECT id FROM weight_history WHERE user_id = ${userId} AND week_start = ${weekStart}
  `);
  if (existing.rows.length > 0) return;

  const deficitResult = await db.execute(sql`
    SELECT COALESCE(SUM(actual_deficit), 0)::float AS total,
           COUNT(*)::int AS days
    FROM daily_calorie_tracking
    WHERE user_id = ${userId} AND date >= ${weekStart} AND date <= ${weekEnd}
  `);
  const weeklyDeficit = parseFloat(deficitResult.rows[0].total) || 0;

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

  await db.execute(sql`
    INSERT INTO weight_history
      (user_id, week_start, week_end, old_weight, new_weight, weekly_calories, weight_change, goal)
    VALUES (${userId}, ${weekStart}, ${weekEnd}, ${oldWeight}, ${newWeight}, ${Math.round(weeklyDeficit)}, ${signedChange}, ${user.goal})
  `);

  await db.execute(sql`
    UPDATE users SET weight = ${newWeight}, updated_at = NOW() WHERE id = ${userId}
  `);

  const { bmr, maintenance_calories, daily_calories, daily_protein } = calculateMetrics(
    newWeight, user.height, user.age, user.gender, user.activity_level, user.goal, user.gym_status
  );

  await db.execute(sql`
    UPDATE users SET bmr = ${bmr}, daily_calories = ${daily_calories}, daily_protein = ${daily_protein} WHERE id = ${userId}
  `);
}

const getWeeklyProgress = async (req, res) => {
  try {
    const userId = req.user.id;

    await logTodayForUser(userId);

    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 1) {
      await applyWeeklyUpdateForUser(userId);
    }

    const week = getWeekDateRange();

    const userRow = await db.execute(sql`
      SELECT daily_calories, goal FROM users WHERE id = ${userId}
    `);
    if (userRow.rows.length > 0) {
      const u = userRow.rows[0];
      const existingDates = await db.execute(sql`
        SELECT to_char(date, 'YYYY-MM-DD') AS ds
        FROM daily_calorie_tracking
        WHERE user_id = ${userId} AND date >= ${week.start} AND date <= ${week.end}
      `);
      const existingSet = new Set(existingDates.rows.map(r => r.ds));
      const weekStart   = new Date(week.start + 'T12:00:00');
      const weekEnd     = new Date(week.end   + 'T12:00:00');
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        const ds = [
          d.getFullYear(),
          String(d.getMonth() + 1).padStart(2, '0'),
          String(d.getDate()).padStart(2, '0'),
        ].join('-');
        if (existingSet.has(ds)) continue;
        const foodResult = await db.execute(sql`
          SELECT COALESCE(SUM(calories), 0)::float AS total_calories
          FROM foods WHERE user_id = ${userId} AND date = ${ds}
        `);
        const consumed = Math.round(parseFloat(foodResult.rows[0].total_calories) || 0);
        if (consumed === 0) continue;
        const target    = Math.round(parseFloat(u.daily_calories) || 0);
        const remaining = target - consumed;
        const actualDeficit = u.goal === 'weight_loss' ? remaining : consumed - target;
        await db.execute(sql`
          INSERT INTO daily_calorie_tracking
            (user_id, date, target_calories, consumed_calories, remaining_calories, actual_deficit)
          VALUES (${userId}, ${ds}, ${target}, ${consumed}, ${remaining}, ${actualDeficit})
          ON CONFLICT (user_id, date) DO UPDATE SET
            target_calories    = EXCLUDED.target_calories,
            consumed_calories  = EXCLUDED.consumed_calories,
            remaining_calories = EXCLUDED.remaining_calories,
            actual_deficit     = EXCLUDED.actual_deficit
        `);
      }
    }

    const daysResult = await db.execute(sql`
      SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date,
             target_calories, consumed_calories, remaining_calories, actual_deficit
      FROM daily_calorie_tracking
      WHERE user_id = ${userId} AND date >= ${week.start} AND date <= ${week.end}
      ORDER BY date ASC
    `);

    const currentDeficit = daysResult.rows.reduce(
      (sum, r) => sum + parseFloat(r.actual_deficit || 0), 0
    );

    const userResult = await db.execute(sql`
      SELECT weight, target_weight, goal, daily_calories FROM users WHERE id = ${userId}
    `);
    const user          = userResult.rows[0];
    const currentWeight = parseFloat(user.weight) || 0;
    const targetWeight  = user.target_weight ? parseFloat(user.target_weight) : null;
    const remainingWeight = targetWeight !== null
      ? parseFloat((targetWeight - currentWeight).toFixed(2))
      : null;

    let estimatedNextMonday = null;
    if (currentDeficit !== 0 && user.goal !== 'maintain') {
      const daysLogged   = daysResult.rows.length;
      const daysLeft     = 7 - daysLogged;
      const avgDaily     = daysLogged > 0 ? currentDeficit / daysLogged : 0;
      const projTotal    = currentDeficit + avgDaily * daysLeft + 500 * 7;
      const estChange    = projTotal / 7700;
      estimatedNextMonday = user.goal === 'weight_loss'
        ? parseFloat((currentWeight - estChange).toFixed(2))
        : parseFloat((currentWeight + estChange).toFixed(2));
    }

    const lastWeek = getLastWeekDateRange();
    const lastWeekResult = await db.execute(sql`
      SELECT COALESCE(SUM(actual_deficit), 0)::float AS total_deficit,
             COUNT(*)::int AS days
      FROM daily_calorie_tracking
      WHERE user_id = ${userId} AND date >= ${lastWeek.start} AND date <= ${lastWeek.end}
    `);
    const lastWeekDeficit     = Math.round(parseFloat(lastWeekResult.rows[0].total_deficit) || 0);
    const lastWeekWeightChange = parseFloat((lastWeekDeficit / 7700).toFixed(2));

    const latestHistory = await db.execute(sql`
      SELECT TO_CHAR(week_start, 'YYYY-MM-DD') AS week_start,
             TO_CHAR(week_end,   'YYYY-MM-DD') AS week_end,
             old_weight, new_weight, weekly_calories, weight_change
      FROM weight_history
      WHERE user_id = ${userId}
      ORDER BY week_start DESC
      LIMIT 1
    `);

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

      const afterResult = await db.execute(sql`
        SELECT COALESCE(SUM(actual_deficit), 0)::float AS total,
               COUNT(*)::int AS days
        FROM daily_calorie_tracking
        WHERE user_id = ${userId} AND date > ${lastWeightUpdateDate}
      `);
      const afterRow = afterResult.rows[0];
      afterUpdateDeficit = Math.round(parseFloat(afterRow.total) || 0);
      const afterDays    = afterRow.days || 0;

      daysSinceUpdate = Math.max(0, Math.floor(
        (Date.now() - new Date(lastWeightUpdateDate).getTime()) / (1000 * 60 * 60 * 24)
      ));

      const fullAfterDeficit = afterUpdateDeficit + 500 * afterDays;
      const estChange = fullAfterDeficit / 7700;
      if (user.goal === 'weight_loss') {
        predictedWeight = parseFloat((currentWeight - estChange).toFixed(2));
      } else if (user.goal === 'weight_gain') {
        predictedWeight = parseFloat((currentWeight + estChange).toFixed(2));
      }

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

const getWeightHistory = async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT id,
             TO_CHAR(week_start, 'YYYY-MM-DD') AS week_start,
             TO_CHAR(week_end,   'YYYY-MM-DD') AS week_end,
             old_weight, new_weight, weekly_calories, weight_change, goal, created_at
      FROM weight_history
      WHERE user_id = ${req.user.id}
      ORDER BY week_start DESC
      LIMIT 20
    `);

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

const logToday = async (req, res) => {
  try {
    await logTodayForUser(req.user.id);
    res.status(200).json({ success: true, message: 'Today logged.' });
  } catch (err) {
    console.error('Log today error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const applyUpdate = async (req, res) => {
  try {
    const userId = req.user.id;

    const userResult = await db.execute(sql`
      SELECT id, weight, goal, height, age, gender, activity_level, gym_status FROM users WHERE id = ${userId}
    `);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const user = userResult.rows[0];
    if (!['weight_loss', 'weight_gain'].includes(user.goal)) {
      return res.status(200).json({ success: true, message: 'Maintain goal — no weight change applied.' });
    }

    const lastHist = await db.execute(sql`
      SELECT TO_CHAR(week_end, 'YYYY-MM-DD') AS week_end
      FROM weight_history WHERE user_id = ${userId} ORDER BY week_end DESC LIMIT 1
    `);
    const sinceDate = lastHist.rows.length > 0 ? lastHist.rows[0].week_end : '1970-01-01';

    const deficitResult = await db.execute(sql`
      SELECT COALESCE(SUM(actual_deficit), 0)::float AS total,
             TO_CHAR(MIN(date), 'YYYY-MM-DD') AS first_date,
             TO_CHAR(MAX(date), 'YYYY-MM-DD') AS last_date,
             COUNT(*)::int AS days
      FROM daily_calorie_tracking
      WHERE user_id = ${userId} AND date > ${sinceDate}
    `);
    const row           = deficitResult.rows[0];
    const totalDeficit  = parseFloat(row.total) || 0;

    const today = new Date().toISOString().split('T')[0];

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

    await db.execute(sql`
      INSERT INTO weight_history
        (user_id, week_start, week_end, old_weight, new_weight, weekly_calories, weight_change, goal)
      VALUES (${userId}, ${row.first_date || today}, ${today}, ${oldWeight}, ${newWeight}, ${Math.round(fullDeficit)}, ${signedChange}, ${user.goal})
    `);

    const { bmr, maintenance_calories, daily_calories, daily_protein } = calculateMetrics(
      newWeight, user.height, user.age, user.gender, user.activity_level, user.goal, user.gym_status
    );

    await db.execute(sql`
      UPDATE users SET
        weight         = ${newWeight},
        bmr            = ${bmr},
        daily_calories = ${daily_calories},
        daily_protein  = ${daily_protein},
        updated_at     = NOW()
      WHERE id = ${userId}
    `);

    const todayFood = await db.execute(sql`
      SELECT COALESCE(SUM(calories), 0)::float AS total FROM foods WHERE user_id = ${userId} AND date = ${today}
    `);
    const todayConsumed  = Math.round(parseFloat(todayFood.rows[0].total) || 0);
    const newTarget      = Math.round(daily_calories);
    const newRemaining   = newTarget - todayConsumed;
    const newDayDeficit  = user.goal === 'weight_loss' ? newRemaining : todayConsumed - newTarget;

    await db.execute(sql`
      INSERT INTO daily_calorie_tracking
        (user_id, date, target_calories, consumed_calories, remaining_calories, actual_deficit)
      VALUES (${userId}, ${today}, ${newTarget}, ${todayConsumed}, ${newRemaining}, ${newDayDeficit})
      ON CONFLICT (user_id, date) DO UPDATE SET
        target_calories    = EXCLUDED.target_calories,
        consumed_calories  = EXCLUDED.consumed_calories,
        remaining_calories = EXCLUDED.remaining_calories,
        actual_deficit     = EXCLUDED.actual_deficit
    `);

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
