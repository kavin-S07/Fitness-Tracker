const { pgTable, uuid, varchar, text, integer, doublePrecision, boolean, timestamp, date, serial, numeric, unique, index } = require('drizzle-orm/pg-core');
const { sql } = require('drizzle-orm');

// =============================================
// USERS
// =============================================
const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 150 }).notNull().unique(),
  password: text('password').notNull(),
  age: integer('age'),
  gender: varchar('gender', { length: 10 }),
  weight: doublePrecision('weight'),
  height: doublePrecision('height'),
  goal: varchar('goal', { length: 20 }),
  gym_status: boolean('gym_status').default(false),
  activity_level: integer('activity_level').default(5),
  bmr: doublePrecision('bmr'),
  daily_calories: doublePrecision('daily_calories'),
  daily_protein: doublePrecision('daily_protein'),
  maintenance_calories: doublePrecision('maintenance_calories'),
  target_weight: doublePrecision('target_weight'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

// =============================================
// FOODS
// =============================================
const foods = pgTable('foods', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  food_name: varchar('food_name', { length: 200 }).notNull(),
  calories: doublePrecision('calories').notNull(),
  protein: doublePrecision('protein').notNull(),
  carbs: doublePrecision('carbs').default(0),
  fats: doublePrecision('fats').default(0),
  quantity: doublePrecision('quantity').default(1),
  unit: varchar('unit', { length: 20 }).default('g'),
  meal_type: varchar('meal_type', { length: 20 }),
  date: date('date').notNull().default(sql`CURRENT_DATE`),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  foodsUserDateIdx: index('idx_foods_user_date').on(table.user_id, table.date),
}));

// =============================================
// EXERCISE
// =============================================
const exercise = pgTable('exercise', {
  id: uuid('id').defaultRandom().primaryKey(),
  exercise_type: varchar('exercise_type', { length: 50 }).notNull(),
  exercise_name: varchar('exercise_name', { length: 150 }).notNull(),
  image_url: text('image_url'),
  target_muscle: varchar('target_muscle', { length: 200 }),
  equipment: varchar('equipment', { length: 200 }),
  difficulty: varchar('difficulty', { length: 20 }),
  description: text('description'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  exerciseTypeIdx: index('idx_exercise_type').on(table.exercise_type),
}));

// =============================================
// WORKOUT LOGS
// =============================================
const workoutLogs = pgTable('workout_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  exercise_id: uuid('exercise_id').references(() => exercise.id, { onDelete: 'cascade' }),
  sets: integer('sets').notNull(),
  reps: integer('reps').notNull(),
  weight: doublePrecision('weight').notNull(),
  workout_date: date('workout_date').notNull().default(sql`CURRENT_DATE`),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  workoutLogsUserDateIdx: index('idx_workout_logs_user_date').on(table.user_id, table.workout_date),
}));

// =============================================
// WEIGHT LOGS
// =============================================
const weightLogs = pgTable('weight_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  weight: doublePrecision('weight').notNull(),
  log_date: date('log_date').notNull().default(sql`CURRENT_DATE`),
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  weightLogsUserDateUnique: unique().on(table.user_id, table.log_date),
  weightLogsUserDateIdx: index('idx_weight_logs_user_date').on(table.user_id, table.log_date),
}));

// =============================================
// DAILY CALORIE TRACKING
// =============================================
const dailyCalorieTracking = pgTable('daily_calorie_tracking', {
  id: serial('id').primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id),
  date: date('date').notNull().default(sql`CURRENT_DATE`),
  target_calories: integer('target_calories').notNull().default(0),
  consumed_calories: numeric('consumed_calories', { precision: 8, scale: 2 }).notNull().default('0'),
  remaining_calories: numeric('remaining_calories', { precision: 8, scale: 2 }).notNull().default('0'),
  actual_deficit: numeric('actual_deficit', { precision: 8, scale: 2 }).notNull().default('0'),
}, (table) => ({
  uniqueUserDate: unique().on(table.user_id, table.date),
}));

// =============================================
// WEIGHT HISTORY
// =============================================
const weightHistory = pgTable('weight_history', {
  id: serial('id').primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id),
  week_start: date('week_start').notNull(),
  week_end: date('week_end').notNull(),
  old_weight: numeric('old_weight', { precision: 5, scale: 2 }).notNull(),
  new_weight: numeric('new_weight', { precision: 5, scale: 2 }).notNull(),
  weekly_calories: integer('weekly_calories').notNull().default(0),
  weight_change: numeric('weight_change', { precision: 5, scale: 2 }).notNull().default('0'),
  goal: varchar('goal', { length: 20 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
});

module.exports = {
  users,
  foods,
  exercise,
  workoutLogs,
  weightLogs,
  dailyCalorieTracking,
  weightHistory,
};
