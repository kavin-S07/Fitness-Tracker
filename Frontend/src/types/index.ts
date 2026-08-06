// ============================================================
// src/types/index.ts  –  All shared TypeScript types
// ============================================================

export interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
  gender?: string;
  weight?: number;
  height?: number;
  goal?: string;
  gym_status?: boolean;
  activity_level?: number;
  bmr?: number;
  maintenance_calories?: number;
  daily_calories?: number;
  daily_protein?: number;
  target_weight?: number;
  created_at?: string;
}

export interface DashboardToday {
  date: string;
  calories_consumed: number;
  protein_consumed: number;
  calories_remaining: number;
  protein_remaining: number;
  workout_sets: number;
  muscle_groups_trained: string;
}

export interface DashboardUser {
  name: string;
  current_weight: number;
  target_weight: number | null;
  goal: string;
  daily_calories_target: number;
  daily_protein_target: number;
  bmr: number;
  maintenance_calories: number;
  bmi: number | null;
  weight_remaining: number | null;
}

export interface FoodReferenceResult {
  id: number;
  food_name: string;
  serving_quantity: string;
  serving_grams: number | null;
  calories_kcal: number;
  protein_g: number;
  carbohydrates_g: number;
  fat_g: number;
}

// ── Food Database page ───────────────────────────────────────
export interface FoodListResult {
  id: number;
  food_name: string;
  serving_quantity: string;
  calories_kcal: number;
  protein_g: number;
  carbohydrates_g: number;
  fat_g: number;
}

export interface FoodListResponse {
  results: FoodListResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type FoodSortBy = 'food_name' | 'calories_kcal' | 'protein_g' | 'carbohydrates_g' | 'fat_g';
export type FoodSortDir = 'asc' | 'desc';

// Full row returned by GET /api/food/reference/:id — every column on
// food_nutrition_reference (macros + micronutrients + vitamins).
export interface FoodReferenceDetail {
  id: number;
  food_name: string;
  serving_quantity: string | null;
  serving_grams: number | null;
  calories_kcal: number;
  protein_g: number;
  carbohydrates_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  saturated_fat_g: number | null;
  cholesterol_mg: number | null;
  sodium_mg: number | null;
  potassium_mg: number | null;
  calcium_mg: number | null;
  iron_mg: number | null;
  magnesium_mg: number | null;
  phosphorus_mg: number | null;
  zinc_mg: number | null;
  vitamin_a_ug: number | null;
  vitamin_b1_mg: number | null;
  vitamin_b2_mg: number | null;
  vitamin_b3_mg: number | null;
  vitamin_b5_mg: number | null;
  vitamin_b6_mg: number | null;
  vitamin_b9_ug: number | null;
  vitamin_b12_ug: number | null;
  vitamin_c_mg: number | null;
  vitamin_d_ug: number | null;
  vitamin_e_mg: number | null;
  vitamin_k_ug: number | null;
}

export interface WeeklyFoodEntry {
  date: string;
  calories: number;
  protein: number;
}

export interface WeeklyWorkoutEntry {
  workout_date: string;
  total_sets: number;
}

export interface Dashboard {
  user: DashboardUser;
  today: DashboardToday;
  weekly_food_chart: WeeklyFoodEntry[];
  weekly_workout_chart: WeeklyWorkoutEntry[];
}

export interface FoodEntry {
  id: number | string;
  food_name: string;
  calories: number;
  protein: number;
  category: string;
  meal_type?: string;
  date: string;
  carbs?: number;
  fats?: number;
  fiber?: number;
}

// ── "Suggest a meal" feature ─────────────────────────────────
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealComboItem {
  id: number;
  food_reference_id: number;
  food_name: string;
  serving_quantity: string | null;
  quantity_multiplier: number;
  calories_kcal: number;
  protein_g: number;
  carbohydrates_g: number;
  fat_g: number;
}

export interface MealCombination {
  id: number;
  meal_type: MealType;
  combo_name: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}

export interface MealSuggestionResponse {
  success: boolean;
  combination: MealCombination | null;
  items: MealComboItem[];
}

export interface Exercise {
  id: number | string;
  exercise_name: string;
  exercise_type: string;
  description?: string;
  equipment?: string;
  difficulty: string;
  target_muscle?: string;
  muscle_group?: string;
  image_url?: string;
}

export interface WorkoutLog {
  id: number | string;
  exercise_id: number | string;
  exercise_name: string;
  exercise_type: string;
  workout_date: string;
  reps: number;
  weight: number;
  sets: number;
  notes?: string;
}

export interface DailyTrackingDay {
  date: string;
  targetCalories: number;
  consumedCalories: number;
  remainingCalories: number;
  actualDeficit: number;
}

export interface WeightHistoryRecord {
  id: number;
  week_start: string;
  week_end: string;
  old_weight: number;
  new_weight: number;
  weekly_calories: number;
  weight_change: number;
  goal: string;
  created_at?: string;
}

export interface WeeklyProgress {
  currentWeight: number;
  targetWeight: number | null;
  remainingWeight: number | null;
  currentWeeklyDeficit: number;
  lastWeekDeficit: number;
  lastWeekWeightChange: number;
  estimatedNextMonday: number | null;
  // After-last-update fields
  previousWeight: number | null;
  lastUpdateDeficit: number | null;
  lastUpdateWeightChange: number | null;
  lastWeightUpdateDate: string | null;
  afterUpdateDeficit: number;
  daysSinceUpdate: number;
  predictedWeight: number | null;
  weightChange: number | null;
  days: DailyTrackingDay[];
  latestWeightHistory: WeightHistoryRecord | null;
}
