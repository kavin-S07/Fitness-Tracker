// ============================================================
// src/services/api.ts  –  All API calls to the backend
// ============================================================
import axios from 'axios';
import { FoodReferenceResult, MealType, MealSuggestionResponse, FoodListResponse, FoodSortBy, FoodSortDir } from '../types';

const BASE_URL = process.env.REACT_APP_API_URL;

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
  addFood: (data: { food_name: string; calories: number; protein: number; carbs?: number; fats?: number; fiber?: number; category: string; date?: string }) =>
    api.post('/food/add', {
      food_name: data.food_name,
      calories: data.calories,
      protein: data.protein,
      carbs: data.carbs ?? 0,
      fats: data.fats ?? 0,
      fiber: data.fiber ?? 0,
      meal_type: data.category.toLowerCase(),
      date: data.date,
    }),

  getToday: () => api.get('/food/today'),

  getByDate: (date: string) => api.get(`/food/date/${date}`),

  getHistory: () => api.get('/food/history'),

  updateFood: (id: string | number, data: {
    food_name?: string; calories?: number; protein?: number;
    carbs?: number; fats?: number; fiber?: number;
    category?: string; date?: string;
  }) => api.put(`/food/${id}`, {
    food_name: data.food_name,
    calories: data.calories,
    protein: data.protein,
    carbs: data.carbs,
    fats: data.fats,
    fiber: data.fiber,
    meal_type: data.category?.toLowerCase(),
    date: data.date,
  }),

  deleteFood: (id: string | number) => api.delete(`/food/${id}`),

  predictFood: (foodName: string) =>
    api.get('/food/predict', { params: { q: foodName } }),

  // Autocomplete search against the food_nutrition_reference table.
  // Returns [] for empty/short queries without hitting the network.
  searchReference: async (query: string): Promise<FoodReferenceResult[]> => {
    if (!query || query.trim().length < 2) return [];
    const res = await api.get<FoodReferenceResult[]>('/food/search', {
      params: { q: query },
    });
    return res.data;
  },

  getReferenceById: (id: number | string) =>
    api.get(`/food/reference/${id}`),

  // Paginated/sortable/searchable browse of the full food_nutrition_reference
  // table, for the standalone Food Database page.
  listReference: async (params: {
    search?: string;
    sortBy?: FoodSortBy;
    sortDir?: FoodSortDir;
    page?: number;
    pageSize?: number;
  }): Promise<FoodListResponse> => {
    const res = await api.get<FoodListResponse>('/food/reference', { params });
    return res.data;
  },

  // "Suggest a meal" — best-match combo for a meal type + remaining targets.
  // exclude carries ids already shown this session so "Next combination"
  // cycles through progressively different (but still valid) matches.
  suggestMeal: (params: {
    mealType: MealType;
    targetCalories: number;
    targetProtein: number;
    exclude?: (number | string)[];
  }) =>
    api.get<MealSuggestionResponse>('/food/suggest', {
      params: {
        mealType: params.mealType,
        targetCalories: params.targetCalories,
        targetProtein: params.targetProtein,
        exclude: params.exclude && params.exclude.length ? params.exclude.join(',') : undefined,
      },
    }),

  // "Surprise me" — a fully random combo for the meal type, ignoring targets.
  randomMeal: (mealType: MealType) =>
    api.get<MealSuggestionResponse>('/food/random', { params: { mealType } }),
};

// ── Exercise ──────────────────────────────────────────────────
export const exerciseAPI = {
  getCategories: () => api.get('/exercise/categories'),

  getList: (type?: string) =>
    api.get('/exercise/list', { params: type ? { type } : {} }),

  getById: (id: string | number) => api.get(`/exercise/${id}`),

  addWorkout: (data: {
    exercise_id: string | number;
    sets: { set_number: number; reps: number; weight: number }[];
    workout_date?: string;
  }) => api.post('/exercise/workout/add', data),

  getTodayWorkout: () => api.get('/exercise/workout/today'),

  getWorkoutHistory: () => api.get('/exercise/workout/history'),

  getAllWorkouts: (days: number = 90) =>
    api.get('/exercise/workout/all', { params: { days } }),

  getExerciseProgress: (exercise_id: string | number) =>
    api.get(`/exercise/workout/progress/${exercise_id}`),

  deleteWorkout: (id: string | number) => api.delete(`/exercise/workout/${id}`),
};

// ── Progress / Deficit Tracking ───────────────────────────────
export const progressAPI = {
  weekly: () => api.get('/progress/weekly'),
  history: () => api.get('/progress/history'),
  logToday: () => api.post('/progress/log-today'),
  applyWeekly: () => api.post('/progress/apply-weekly'),
};

export default api;