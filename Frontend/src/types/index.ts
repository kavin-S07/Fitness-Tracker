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
  daily_calories?: number;
  daily_protein?: number;
  target_weight?: number;
  created_at?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
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
  target_weight: number;
  goal: string;
  daily_calories_target: number;
  daily_protein_target: number;
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
  // BUG FIX: backend exposes meal_type as `category` for frontend grouping
  category: string;
  meal_type?: string;
  date: string;
  carbs?: number;
  fats?: number;
}

export interface TodayFoodResponse {
  success: boolean;
  date: string;
  summary: {
    total_calories: number;
    total_protein: number;
    calorie_target: number;
    protein_target: number;
    remaining_calories: number;
    remaining_protein: number;
  };
  foods: FoodEntry[];
}

export interface Exercise {
  id: number | string;
  exercise_name: string;
  exercise_type: string;
  description?: string;
  equipment?: string;
  difficulty: string;
  // BUG FIX: was named `muscle_group` but DB column is `target_muscle`
  target_muscle?: string;
  muscle_group?: string;
  image_url?: string;
}

export interface WorkoutSet {
  set_number: number;
  reps: number;
  weight: number;
}

export interface WorkoutLog {
  id: number | string;
  exercise_id: number | string;
  exercise_name: string;
  exercise_type: string;
  workout_date: string;
  // BUG FIX: backend now returns one row per set, so reps/weight/sets
  // are flat scalar fields on each WorkoutLog row, not a nested array.
  reps: number;
  weight: number;
  sets: number;
  notes?: string;
}

export interface WeeklyReport {
  week_summary: { start_date: string; end_date: string };
  nutrition: {
    avg_daily_calories: number;
    avg_daily_protein: number;
    days_food_logged: number;
    calorie_target: number;
    protein_target: number;
  };
  workout: {
    workout_days: number;
    total_sets: number;
    muscle_groups_trained: string;
    strongest_muscle: string;
    missed_days: number;
  };
  weight: {
    start_weight: number;
    end_weight: number;
    change: string | null;
    target_weight: number;
    progress_status: string;
  };
}

export type GoalType = 'weight_loss' | 'weight_gain' | 'maintain';