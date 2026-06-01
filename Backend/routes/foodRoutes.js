const express = require('express');
const router = express.Router();
const { addFood, getTodayFood, getFoodHistory, getFoodByDate, deleteFood } = require('../controllers/foodController');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// POST /api/food/add
router.post('/add', addFood);

// GET /api/food/today
router.get('/today', getTodayFood);

// GET /api/food/history
router.get('/history', getFoodHistory);

// GET /api/food/date/:date  (e.g., /api/food/date/2026-05-30)
router.get('/date/:date', getFoodByDate);

// DELETE /api/food/:id
router.delete('/:id', deleteFood);

module.exports = router;
