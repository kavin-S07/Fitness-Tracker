const express = require('express');
const router = express.Router();

const {
  getExercises,
  getCategories,
  getExerciseById,
  addWorkout,
  getTodayWorkout,
  getWorkoutHistory,
  getExerciseProgress,
  deleteWorkout,
  getAllWorkouts,
} = require('../controllers/exerciseController');

const authMiddleware = require('../middleware/auth');

// =============================================
// BUG FIX: Workout sub-routes MUST come before /:id
// Previously, GET /workout/today was matched by /:id
// with id="workout", causing DB lookups to fail silently.
// Rule: specific routes before parameterized catch-all routes.
// =============================================

// --- Workout routes (protected) ---
router.post('/workout/add', authMiddleware, addWorkout);
router.get('/workout/today', authMiddleware, getTodayWorkout);
router.get('/workout/history', authMiddleware, getWorkoutHistory);
router.get('/workout/progress/:exercise_id', authMiddleware, getExerciseProgress);
router.delete('/workout/:id', authMiddleware, deleteWorkout);
router.get('/workout/all', authMiddleware, getAllWorkouts); // New route to get all workouts for the user

// --- Exercise library routes (public) ---
// These must come AFTER the /workout/* routes
router.get('/categories', getCategories);
router.get('/list', getExercises);
router.get('/:id', getExerciseById); // catch-all — keep last

module.exports = router;
