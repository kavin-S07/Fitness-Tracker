const cron = require('node-cron');
const pool = require('../config/db');
const { calculateMetrics } = require('../utils/metrics');

// Used once when the server starts, to set up a recurring background job.
// Registers a task that runs weekly to update each user's weight based on their tracked calorie deficit.
module.exports = function scheduleWeeklyWeightCron() {
  // ── Cron: weekly weight update on Monday 00:00 ───────────────
  // FIXED: sums actual_deficit directly, no extra +500 multiplier.
  // Used automatically every Monday at midnight by the cron scheduler.
  // Estimates each active user's new weight from their week of calorie tracking and updates their targets.
  cron.schedule('0 0 * * 1', async () => {
    try {
      const users = await pool.query(
        "SELECT id FROM users WHERE goal IN ('weight_loss', 'weight_gain')"
      );
      for (const u of users.rows) {
        const uRes = await pool.query(
          'SELECT id, weight, goal, height, age, gender, activity_level, gym_status FROM users WHERE id = $1',
          [u.id]
        );
        if (uRes.rows.length === 0) continue;
        const user = uRes.rows[0];
        if (!['weight_loss', 'weight_gain'].includes(user.goal)) continue;

        // Calculate the date range to process: from the day after the last
        // weight_history.week_end through yesterday. This rolling window
        // continues from wherever the last update (manual or automatic) left off,
        // instead of always assuming a fixed Monday–Sunday calendar week.
        const d = new Date();
        const yesterday = new Date(d);
        yesterday.setDate(d.getDate() - 1);

        const lastHistRes = await pool.query(
          `SELECT TO_CHAR(week_end, 'YYYY-MM-DD') AS week_end
           FROM weight_history WHERE user_id = $1 ORDER BY week_end DESC LIMIT 1`,
          [u.id]
        );
        const lastWeekEnd = lastHistRes.rows.length > 0
          ? lastHistRes.rows[0].week_end
          : '1970-01-01';

        const startDate = new Date(lastWeekEnd);
        startDate.setDate(startDate.getDate() + 1);
        const ws = startDate.toISOString().split('T')[0];
        const we = yesterday.toISOString().split('T')[0];

        // Skip if there are no days to process (manual update already covered up to yesterday or today)
        if (startDate > yesterday) continue;

        const defRes = await pool.query(
          `SELECT COALESCE(SUM(actual_deficit), 0)::float AS total
           FROM daily_calorie_tracking
           WHERE user_id = $1 AND date >= $2 AND date <= $3`,
          [u.id, ws, we]
        );
        const weekly = parseFloat(defRes.rows[0].total) || 0;
        const change = weekly / 7700;
        const oldW   = parseFloat(user.weight);
        const newW   = Math.round(
          (user.goal === 'weight_loss' ? oldW - change : oldW + change) * 100
        ) / 100;

        await pool.query(
          `INSERT INTO weight_history
             (user_id, week_start, week_end, old_weight, new_weight, weekly_calories, weight_change, goal)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [u.id, ws, we, oldW, newW, Math.round(weekly), parseFloat((newW - oldW).toFixed(2)), user.goal]
        );

        await pool.query(
          'UPDATE users SET weight = $1, updated_at = NOW() WHERE id = $2',
          [newW, u.id]
        );

        const m = calculateMetrics(
          newW, user.height, user.age, user.gender, user.activity_level, user.goal, user.gym_status
        );
        await pool.query(
          'UPDATE users SET bmr = $1, daily_calories = $2, daily_protein = $3 WHERE id = $4',
          [m.bmr, m.daily_calories, m.daily_protein, u.id]
        );
      }
      console.log('✅ Weekly weight update applied for all users');
    } catch (err) { console.error('❌ Weekly cron error:', err); }
  });
};
