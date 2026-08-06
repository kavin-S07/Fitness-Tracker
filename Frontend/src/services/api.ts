// ============================================================
// src/services/api.ts  –  All API calls to the backend
// ============================================================
import axios from 'axios';
import { FoodReferenceResult, MealType, MealSuggestionResponse, FoodListResponse, FoodSortBy, FoodSortDir } from '../types';

const BASE_URL = process.env.REACT_APP_API_URL;

const api = axios.create({ baseURL: BASE_URL });

// Used automatically before every API request the app makes.
// Attaches the logged-in user's JWT token to the request so the backend can identify them.
api.interceptors.request.use((config) => {
  
  const token = localStorage.getItem('ft_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ────────────────────────────────────────────────────
export const authAPI = {
  // Used when a user submits the login form.
  // Sends the email/password to the backend and gets back a login token.
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  // Used when a user submits the signup form.
  // Sends the new account details to the backend to create the user.
  signup: (data: Record<string, unknown>) =>
    api.post('/auth/signup', data),

  // Used when the profile page loads.
  // Fetches the logged-in user's saved profile details.
  getProfile: () => api.get('/auth/profile'),

  // Used when a user saves changes on the profile page.
  // Sends the updated profile fields to the backend.
  updateProfile: (data: Record<string, unknown>) =>
    api.put('/auth/profile', data),
};

// ── Dashboard ────────────────────────────────────────────────
export const dashboardAPI = {
  // Used when the home/dashboard page loads.
  // Fetches the user's daily summary (calories, protein, workouts).
  get: () => api.get('/dashboard'),
  // Used when the user views their weekly report.
  // Fetches the summarized nutrition/workout/weight report for the past week.
  weeklyReport: () => api.get('/report/weekly'),
  // Used when a user logs their current weight.
  // Sends the new weight entry to the backend.
  logWeight: (weight: number, date?: string) =>
    api.post('/weight/log', { weight, date }),
  // Used to show the user's weight trend.
  // Fetches the user's recent weight log entries.
  weightHistory: () => api.get('/weight/history'),
};

// ── Food ─────────────────────────────────────────────────────
export const foodAPI = {
  // Used when a user submits the "add food" form.
  // Sends a new food entry to be saved for the user.
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

  // Used when the Food page loads.
  // Fetches everything the user has logged today.
  getToday: () => api.get('/food/today'),

  // Used when a user picks a specific date to view on the Food page.
  // Fetches the foods logged on that date.
  getByDate: (date: string) => api.get(`/food/date/${date}`),

  // Used to show the user's overall food logging history.
  // Fetches daily calorie/protein totals across all logged days.
  getHistory: () => api.get('/food/history'),

  // Used when a user edits a food entry they already logged.
  // Sends the updated food fields to the backend.
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

  // Used when a user deletes a logged food entry.
  // Tells the backend to remove that food entry.
  deleteFood: (id: string | number) => api.delete(`/food/${id}`),

  // Used as the user types into the food autocomplete search box.
  // Fetches matching foods from the reference database for live suggestions.
  // Autocomplete search against the food_nutrition_reference table.
  // Returns [] for empty/short queries without hitting the network.
  searchReference: async (query: string): Promise<FoodReferenceResult[]> => {
    if (!query || query.trim().length < 2) return [];
    const res = await api.get<FoodReferenceResult[]>('/food/search', {
      params: { q: query },
    });
    return res.data;
  },

  // Used when a user clicks a food to view its full nutrition details.
  // Fetches the complete reference record for one food by ID.
  getReferenceById: (id: number | string) =>
    api.get(`/food/reference/${id}`),

  // Used when the Food Database page loads or the user searches/sorts/pages through it.
  // Fetches a page of foods from the reference table matching the given filters.
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

  // Used when the user clicks "Suggest a meal" on the Food page.
  // Fetches the best-matching meal combo for the user's remaining calorie/protein targets.
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

  // Used when the user clicks "Surprise me" for a random meal suggestion.
  // Fetches a random meal combo for the chosen meal type.
  // "Surprise me" — a fully random combo for the meal type, ignoring targets.
  randomMeal: (mealType: MealType) =>
    api.get<MealSuggestionResponse>('/food/random', { params: { mealType } }),
};

// ── Exercise ──────────────────────────────────────────────────
export const exerciseAPI = {
  // Used when the Exercise page loads its category filter.
  // Fetches the list of exercise categories (muscle groups).
  getCategories: () => api.get('/exercise/categories'),

  // Used when the exercise library is displayed, optionally filtered by type.
  // Fetches the list of exercises.
  getList: (type?: string) =>
    api.get('/exercise/list', { params: type ? { type } : {} }),

  // Used when a user views a specific exercise's details.
  // Fetches one exercise by its ID.
  getById: (id: string | number) => api.get(`/exercise/${id}`),

  // Used when a user logs a workout on the Exercise page.
  // Sends the sets/reps/weight for the chosen exercise to be saved.
  addWorkout: (data: {
    exercise_id: string | number;
    sets: { set_number: number; reps: number; weight: number }[];
    workout_date?: string;
  }) => api.post('/exercise/workout/add', data),

  // Used when the Exercise page loads to show today's logged workouts.
  // Fetches all workout sets logged today.
  getTodayWorkout: () => api.get('/exercise/workout/today'),

  // Used to show a user's recent workout activity.
  // Fetches a day-by-day summary of workouts over the last 30 days.
  getWorkoutHistory: () => api.get('/exercise/workout/history'),

  // Used when a user wants to view their full workout history.
  // Fetches all workout logs from the last N days.
  getAllWorkouts: (days: number = 90) =>
    api.get('/exercise/workout/all', { params: { days } }),

  // Used when a user views their progress chart for a specific exercise.
  // Fetches the max weight/reps/sets logged per day for that exercise.
  getExerciseProgress: (exercise_id: string | number) =>
    api.get(`/exercise/workout/progress/${exercise_id}`),

  // Used when a user deletes a logged workout entry.
  // Tells the backend to remove that workout entry.
  deleteWorkout: (id: string | number) => api.delete(`/exercise/workout/${id}`),
};

// ── Progress / Deficit Tracking ───────────────────────────────
export const progressAPI = {
  // Used when the Progress page loads.
  // Fetches this week's calorie deficit progress and projected weight change.
  weekly: () => api.get('/progress/weekly'),
  // Used to show a user's past weekly weight updates.
  // Fetches the history of weekly weight-change records.
  history: () => api.get('/progress/history'),
  // Used to refresh today's calorie tracking on demand.
  // Tells the backend to recalculate today's deficit/surplus.
  logToday: () => api.post('/progress/log-today'),
  // Used when the user clicks "Update Weight" on the Progress page.
  // Tells the backend to apply the accumulated deficit to the user's weight.
  applyWeekly: () => api.post('/progress/apply-weekly'),
};

export default api;
