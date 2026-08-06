const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const app = express();

// =============================================
// MIDDLEWARE
// =============================================
app.use(cors({
  origin: [
    'http://localhost:300',
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
// Used to check that the backend server is running (e.g. by monitoring tools or during setup).
// Returns a simple success message with the current timestamp.
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
// Used automatically whenever a request hits a route that doesn't exist.
// Sends back a "route not found" error response.
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// =============================================
// GLOBAL ERROR HANDLER
// =============================================
// Used automatically whenever any route throws an unhandled error.
// Logs the error and sends back a generic server error response.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// =============================================
// START SERVER (after table creation)
// =============================================
// START SERVER
// =============================================
const scheduleDailyCalorieCron = require('./cron/dailyCalorieCron');
const scheduleWeeklyWeightCron = require('./cron/weeklyWeightCron');
const PORT = process.env.PORT || 5000;

(async () => {
  scheduleDailyCalorieCron();
  scheduleWeeklyWeightCron();

  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📋 API Health: http://localhost:${PORT}/api/health`);
  });
})();

module.exports = app;
