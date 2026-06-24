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
const dashboardRoutes = require('./routes/dashboardRoutes');

// ── Public routes (no auth) ──────────────────
app.use('/api/auth',     authRoutes);

// ── Feature routes ───────────────────────────
app.use('/api/food',     foodRoutes);
app.use('/api/exercise', exerciseRoutes);

// ── Dashboard routes (mounted at specific paths, NOT bare /api) ──
const { getDashboard, getWeeklyReport, logWeight, getWeightHistory } = require('./controllers/dashboardController');
const authMiddleware = require('./middleware/auth');

app.get('/api/dashboard',      authMiddleware, getDashboard);
app.get('/api/report/weekly',  authMiddleware, getWeeklyReport);
app.post('/api/weight/log',    authMiddleware, logWeight);
app.get('/api/weight/history', authMiddleware, getWeightHistory);

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
// START SERVER
// =============================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📋 API Health: http://localhost:${PORT}/api/health`);
});

module.exports = app;