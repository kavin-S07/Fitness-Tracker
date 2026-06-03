const express = require('express');
const router = express.Router();
const { signup, login, getProfile, updateProfile } = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

// POST /api/auth/signup
router.post('/signup', signup);

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/profile  (protected)
router.get('/profile', authMiddleware, getProfile);

// PUT /api/auth/profile  (protected)
router.put('/profile', authMiddleware, updateProfile);

module.exports = router;
