const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const app = express();

// =============================================
// MIDDLEWARE
// =============================================
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.FRONTEND_URL,
    /\.vercel\.app$/,
  ],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================================
// ROUTES
// =============================================
const authRoutes      = require('./routes/authRoutes');
const foodRoutes      = require('./routes/foodRoutes');
const exerciseRoutes  = require('./routes/exerciseRoutes');
const progressRoutes  = require('./routes/progressRoutes');

app.use('/api/auth',     authRoutes);
app.use('/api/food',     foodRoutes);
app.use('/api/exercise', exerciseRoutes);

// ── Dashboard / weight routes ─────────────────────────────────
const {
  getDashboard, getWeeklyReport, logWeight, getWeightHistory,
} = require('./controllers/dashboardController');
const authMiddleware = require('./middleware/auth');

app.get('/api/dashboard',      authMiddleware, getDashboard);
app.get('/api/report/weekly',  authMiddleware, getWeeklyReport);
app.post('/api/weight/log',    authMiddleware, logWeight);
app.get('/api/weight/history', authMiddleware, getWeightHistory);

// ── Progress / deficit tracking routes ────────────────────────
app.use('/api/progress', progressRoutes);

// =============================================
// HEALTH CHECK
// =============================================
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success:   true,
    message:   'Fitness Tracker API is running! 🏋️',
    timestamp: new Date().toISOString(),
  });
});

// =============================================
// 404 HANDLER
// =============================================
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// =============================================
// GLOBAL ERROR HANDLER
// =============================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// =============================================
// START SERVER (after table creation)
// =============================================
const { pool, db } = require('./db');
const cron = require('node-cron');
const { calculateMetrics } = require('./utils/metrics');
const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_calorie_tracking (
        id                 SERIAL PRIMARY KEY,
        user_id            UUID NOT NULL REFERENCES users(id),
        date               DATE NOT NULL DEFAULT CURRENT_DATE,
        target_calories    INTEGER NOT NULL DEFAULT 0,
        consumed_calories  NUMERIC(8,2) NOT NULL DEFAULT 0,
        remaining_calories NUMERIC(8,2) NOT NULL DEFAULT 0,
        actual_deficit     NUMERIC(8,2) NOT NULL DEFAULT 0,
        UNIQUE(user_id, date)
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS weight_history (
        id              SERIAL PRIMARY KEY,
        user_id         UUID NOT NULL REFERENCES users(id),
        week_start      DATE NOT NULL,
        week_end        DATE NOT NULL,
        old_weight      NUMERIC(5,2) NOT NULL,
        new_weight      NUMERIC(5,2) NOT NULL,
        weekly_calories INTEGER NOT NULL DEFAULT 0,
        weight_change   NUMERIC(5,2) NOT NULL DEFAULT 0,
        goal            VARCHAR(20) NOT NULL,
        created_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Progress tracking tables ensured');
  } catch (err) {
    console.error('❌ Table creation error:', err.message);
  }

  // ── Cron: daily deficit snapshot at 23:59 ───────────────────
  // FIXED: no longer double-counts the 500 kcal goal adjustment.
  // actual_deficit = target - consumed  (for weight_loss)
  //                = consumed - target  (for weight_gain)
  // target already includes the ±500 from calculateMetrics.
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

  // ── Cron: weekly weight update on Monday 00:00 ───────────────
  // FIXED: sums actual_deficit directly, no extra +500 multiplier.
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

        // Calculate last week's date range
        const d    = new Date();
        const dow  = d.getDay();
        const diff = dow === 0 ? 6 : dow - 1;
        const lastMon = new Date(d);
        lastMon.setDate(d.getDate() - diff - 7);
        const lastSun = new Date(lastMon);
        lastSun.setDate(lastMon.getDate() + 6);
        const ws = lastMon.toISOString().split('T')[0];
        const we = lastSun.toISOString().split('T')[0];

        const ex = await pool.query(
          'SELECT id FROM weight_history WHERE user_id = $1 AND week_start = $2',
          [u.id, ws]
        );
        if (ex.rows.length > 0) continue;

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

  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📋 API Health: http://localhost:${PORT}/api/health`);
  });
})();

module.exports = app;
