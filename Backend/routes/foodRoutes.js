
const express = require('express');
const router = express.Router();
const { addFood, getTodayFood, getFoodHistory, getFoodByDate, updateFood, deleteFood } = require('../controllers/foodController');
const { searchFoodReference, getFoodReferenceById, listFoodReference } = require('../controllers/foodReferenceController');
const { suggestMeal, randomMeal } = require('../controllers/suggestionController');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET /api/food/search?q=<text>  ← live autocomplete against
// food_nutrition_reference (up to 10 ranked matches)
// GET /api/food/reference?search=&sortBy=&sortDir=&page=&pageSize=
//   ← paginated/sortable browse of the full table for the Food Database page
// GET /api/food/reference/:id    ← full nutrition detail for one match
// Placed before /:id for route-ordering reasons.
router.get('/search', searchFoodReference);
router.get('/reference', listFoodReference);
router.get('/reference/:id', getFoodReferenceById);

// GET /api/food/suggest?mealType=&targetCalories=&targetProtein=&exclude=
// GET /api/food/random?mealType=
// "Suggest a meal" feature — placed before /:id for the same reason as above.
router.get('/suggest', suggestMeal);
router.get('/random', randomMeal);

// POST /api/food/add
router.post('/add', addFood);

// GET /api/food/today
router.get('/today', getTodayFood);

// GET /api/food/history
router.get('/history', getFoodHistory);

// GET /api/food/date/:date  (e.g., /api/food/date/2026-05-30)
router.get('/date/:date', getFoodByDate);

// PUT /api/food/:id
router.put('/:id', updateFood);

// DELETE /api/food/:id
router.delete('/:id', deleteFood);

module.exports = router;
