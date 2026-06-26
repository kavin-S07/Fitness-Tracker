const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getWeeklyProgress, getWeightHistory, logToday, applyUpdate } = require('../controllers/progressController');

router.get('/weekly', authMiddleware, getWeeklyProgress);
router.get('/history', authMiddleware, getWeightHistory);
router.post('/log-today', authMiddleware, logToday);
router.post('/apply-weekly', authMiddleware, applyUpdate);

module.exports = router;
