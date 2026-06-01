const express = require('express');
const router = express.Router();
const { getDashboard, getWeeklyReport, logWeight, getWeightHistory } = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET /api/dashboard
router.get('/dashboard', getDashboard);

// GET /api/report/weekly
router.get('/report/weekly', getWeeklyReport);

// POST /api/weight/log
router.post('/weight/log', logWeight);

// GET /api/weight/history
router.get('/weight/history', getWeightHistory);

module.exports = router;
