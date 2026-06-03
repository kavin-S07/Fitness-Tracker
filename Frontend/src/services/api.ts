// ============================================================
// src/services/api.ts  –  All API calls to the backend
// ============================================================
import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: BASE_URL });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ft_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ────────────────────────────────────────────────────
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  signup: (data: Record<string, unknown>) =>
    api.post('/auth/signup', data),

  verifyOTP: (email: string, otp: string) =>
    api.post('/auth/verify-otp', { email, otp }),

  resendOTP: (email: string) =>
    api.post('/auth/resend-otp', { email }),

  getProfile: () => api.get('/auth/profile'),

  updateProfile: (data: Record<string, unknown>) =>
    api.put('/auth/profile', data),
};

// ── Dashboard ────────────────────────────────────────────────
export const dashboardAPI = {
  get: () => api.get('/dashboard'),
  weeklyReport: () => api.get('/report/weekly'),
  logWeight: (weight: number, date?: string) =>
    api.post('/weight/log', { weight, date }),
  weightHistory: () => api.get('/weight/history'),
};

// ── Food ─────────────────────────────────────────────────────
export const foodAPI = {
  // BUG FIX: Send `meal_type` (lowercase) so backend validation passes.
  // Old code sent `category` (capitalised) which hit the 400 validation error.
  addFood: (data: { food_name: string; calories: number; protein: number; category: string; date?: string }) =>
    api.post('/food/add', {
      food_name: data.food_name,
      calories: data.calories,
      protein: data.protein,
      meal_type: data.category.toLowerCase(), // normalise here
      date: data.date,
    }),

  getToday: () => api.get('/food/today'),

  getByDate: (date: string) => api.get(`/food/date/${date}`),

  getHistory: () => api.get('/food/history'),

  deleteFood: (id: string | number) => api.delete(`/food/${id}`),
};

// ── Exercise ──────────────────────────────────────────────────
export const exerciseAPI = {
  getCategories: () => api.get('/exercise/categories'),

  getList: (type?: string) =>
    api.get('/exercise/list', { params: type ? { type } : {} }),

  getById: (id: string | number) => api.get(`/exercise/${id}`),

  // BUG FIX: Routes are mounted at /api/exercise, so workout sub-routes
  // must be /exercise/workout/add not /workout/add.
  // Old code used bare /workout/add which hit 404 every time.
  addWorkout: (data: {
    exercise_id: string | number;
    sets: { set_number: number; reps: number; weight: number }[];
    workout_date?: string;
  }) => api.post('/exercise/workout/add', data),

  getTodayWorkout: () => api.get('/exercise/workout/today'),

  getWorkoutHistory: () => api.get('/exercise/workout/history'),

  getExerciseProgress: (exercise_id: string | number) =>
    api.get(`/exercise/workout/progress/${exercise_id}`),

  deleteWorkout: (id: string | number) => api.delete(`/exercise/workout/${id}`),
};

export default api;