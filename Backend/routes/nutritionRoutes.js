const express = require('express');
const router = express.Router();
const { getNutrition } = require('../controllers/nutritionController');
const authMiddleware = require('../middleware/auth');

// All nutrition routes require authentication (protects API key usage)
router.use(authMiddleware);

// GET /api/nutrition?food=Chicken%20Biryani
// POST /api/nutrition  { "food": "Chicken Biryani with 250g chicken" }
router.get('/', getNutrition);
router.post('/', getNutrition);

module.exports = router;
