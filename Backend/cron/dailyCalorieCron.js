const cron = require('node-cron');
const pool = require('../config/db');

// Used once when the server starts, to set up a recurring background job.
// Registers a task that runs every night at 23:59 to save each user's calorie deficit/surplus for the day.
module.exports = function scheduleDailyCalorieCron() {
  // ── Cron: daily deficit snapshot at 23:59 ───────────────────
  // FIXED: no longer double-counts the 500 kcal goal adjustment.
  // actual_deficit = target - consumed  (for weight_loss)
  //                = consumed - target  (for weight_gain)
  // target already includes the ±500 from calculateMetrics.
  // Used automatically every day at 23:59 by the cron scheduler.
  // Calculates and saves each active user's calorie deficit/surplus for that day.
  cron.schedule('59 23 * * *', async () => {
    try {
      const users = await pool.query(
        "SELECT id FROM users WHERE goal IN ('weight_loss', 'weight_gain')"
      );
      for (const u of users.rows) {
        const uRes = await pool.query(
          'SELECT daily_calories, goal FROM users WHERE id = $1',
          [u.id]
        );
        if (uRes.rows.length === 0) continue;
        const user = uRes.rows[0];
        if (!['weight_loss', 'weight_gain'].includes(user.goal)) continue;

        const today    = new Date().toISOString().split('T')[0];
        const target   = Math.round(parseFloat(user.daily_calories) || 0);

        const fRes = await pool.query(
          `SELECT COALESCE(SUM(calories), 0)::float AS total
           FROM foods WHERE user_id = $1 AND date = $2`,
          [u.id, today]
        );
        const consumed  = Math.round(parseFloat(fRes.rows[0].total) || 0);
        const remaining = target - consumed;

        // actual_deficit: positive = on track toward goal
        const deficit = user.goal === 'weight_loss'
          ? remaining          // calories still available (positive = saved)
          : consumed - target; // surplus eaten (positive = on track for gain)

        await pool.query(
          `INSERT INTO daily_calorie_tracking
             (user_id, date, target_calories, consumed_calories, remaining_calories, actual_deficit)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (user_id, date) DO UPDATE SET
             target_calories    = EXCLUDED.target_calories,
             consumed_calories  = EXCLUDED.consumed_calories,
             remaining_calories = EXCLUDED.remaining_calories,
             actual_deficit     = EXCLUDED.actual_deficit`,
          [u.id, today, target, consumed, remaining, deficit]
        );
      }
      console.log('✅ Daily calorie tracking logged for all users');
    } catch (err) { console.error('❌ Daily cron error:', err); }
  });
};
