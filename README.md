# 🏋️ FitnessTracker

A full-stack fitness tracking web application that helps users monitor their daily nutrition, log workouts, track body weight progress, and view weekly performance reports — all in one place.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Known Issues & Bug Fixes](#known-issues--bug-fixes)

---

## Overview

FitnessTracker is a personalized fitness companion that calculates your daily calorie and protein targets using the **Mifflin-St Jeor BMR formula**, adjusted for your activity level and fitness goal (weight loss, weight gain, or maintenance). Once signed up, you can log every meal, every workout set, and your daily body weight — then watch your progress unfold in charts and weekly summaries.

---

## Features

### Authentication & Profile
- Secure signup with full onboarding: age, gender, weight, height, fitness goal, gym status, and activity level
- JWT-based authentication (token stored in `localStorage`)
- Auto-calculated BMR, daily calorie target, and daily protein target on signup and profile update
- Editable profile page to update stats and recalculate targets at any time

### Dashboard (Home)
- Today's calorie and protein consumed vs. target, with remaining amounts
- Today's workout summary: total sets logged and muscle groups trained
- Weekly calorie and protein intake bar charts (powered by Recharts)
- Weekly workout volume chart
- Current weight vs. target weight display
- **After Last Update Report**: previous weight, current weight, deficit since update, days since update, predicted weight

### Calorie Deficit Tracking
- Automatic daily log of calorie target, consumed, remaining, and actual deficit
- `actual_deficit` tracks surplus/deficit relative to the daily target (already maintenance ± 500)
- Weekly deficit summary with projected weight change (7700 kcal = 1 kg)
- Backfill: missing `daily_calorie_tracking` rows are created on page load for any day that has food data
- Zero-calorie row cleanup: phantom deficit rows for days with no food logged are deleted

### Weight Updates
- **Update Weight** button on Profile page: snapshots accumulated deficit into `weight_history`, recalculates BMR/maintenance/targets for the new weight, and resets the tracking cycle
- Full maintenance deficit (actual_deficit + 500 per day) used for weight change calculations
- After-update deficit counter shows deficit accumulated since last weight update
- Estimated weight projection based on full maintenance deficit

### Food Tracker
- Log meals with food name, calories, protein, carbs, fats, meal type (Breakfast / Lunch / Dinner / Snack), and date
- **Autofill autocomplete**: typing a food name queries the `food_nutrition_reference` table (debounced 300ms) and offers ranked matches; selecting one pre-fills calories/protein/carbs/fats, scaled live by a servings multiplier, while staying manually editable
- **Predictive autofill fallback** (`/food/predict`): fuzzy-matches a typed food name against the reference table server-side when the user types a full entry without picking a suggestion
- **Suggest a Meal panel**: generates a best-match food combination for a meal type against remaining calorie/protein targets, with a "Next combination" option and a "Surprise me" random combo, both drawn from a seeded `meal_combinations` table
- View today's food log grouped by meal type
- Browse food history by date
- Edit and delete individual food entries
- Running daily totals for calories and protein

### Food Database
- Standalone reference/browsing page (`/food-database`) over the full `food_nutrition_reference` table — independent of logging anything
- Debounced search (300ms) by food name, with results resetting to page 1 on each new query
- Sortable table (Name, Calories, Protein, Carbs, Fat) — click a header to sort, click again to flip direction; sort persists across pagination
- Server-side pagination (20 per page, capped at 100) using a single query with `COUNT(*) OVER()` for the total row count
- Row click opens a detail view with all ~25 nutrition fields, grouped into **Macros**, **Micronutrients**, and **Vitamins** for scannability
- Reuses the same `GET /api/food/reference/:id` endpoint as the Food Tracker's autofill for the detail view — no duplicated queries

### Exercise / Gym Tracker
- Browse a seeded exercise library organized by muscle group (Chest, Back, Biceps, Shoulders, etc.)
- Each exercise card shows target muscles, equipment needed, difficulty level, and a demonstration image
- Log workout sets (reps × weight) against any exercise for any date
- View today's workout log
- Browse full workout history
- Track progress for a specific exercise over time (progressive overload view)
- Delete individual workout entries

### Weight Tracker
- Log daily body weight
- View full weight history
- Weekly report shows start weight, end weight, net change, and progress status vs. target

### Weekly Report
- 7-day nutrition summary: average daily calories and protein, days logged, vs. targets
- 7-day workout summary: active days, total sets, muscle groups hit, strongest muscle group, missed days
- Weight progress snapshot for the week with deficit-based nutrition section (avg consumed, avg deficit, total weekly deficit)
- Weight history section: current weight, last update change, deficit since update, estimated weight

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| TypeScript | Type safety |
| React Router v6 | Client-side routing |
| Axios | HTTP client with JWT interceptor |
| Recharts | Charts and data visualizations |
| CSS (custom) | Glassmorphism-style UI with light theme |

### Backend
| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| Express 5 | Web framework |
| PostgreSQL | Relational database |
| `pg` (node-postgres) | Database driver |
| bcryptjs | Password hashing |
| jsonwebtoken | JWT creation and verification |
| express-validator | Request validation |
| dotenv | Environment variable management |
| cors | Cross-origin resource sharing |

### Infrastructure
| Service | Role |
|---|---|
| Render | Backend deployment |
| Vercel | Frontend deployment |
| Neon (PostgreSQL) | Managed cloud database |

---

## Project Structure

```
Fittracker/
├── Backend/
│   ├── config/
│   │   └── db.js                 # PostgreSQL connection pool
│   ├── controllers/
│   │   ├── authController.js         # Signup, login, profile CRUD + BMR calc
│   │   ├── dashboardController.js    # Dashboard summary, weekly report, weight log
│   │   ├── exerciseController.js     # Exercise library + workout log CRUD
│   │   ├── foodController.js         # Food log CRUD
│   │   ├── foodPredictController.js  # Fuzzy-match autofill fallback (/food/predict)
│   │   ├── foodReferenceController.js# Autocomplete search, paginated list, detail view for food_nutrition_reference
│   │   ├── suggestionController.js   # "Suggest a meal" / "Surprise me" combinations
│   │   └── progressController.js     # Daily calorie tracking, deficit tracking, weight updates
│   ├── middleware/
│   │   └── auth.js               # JWT verification middleware
│   ├── models/
│   │   ├── schema.sql                        # Full DB schema + exercise seed data
│   │   ├── food_nutrition_reference_schema.sql
│   │   └── meal_combinations_schema.sql
│   ├── services/
│   │   └── foodMatchService.js   # Fuzzy-matching logic behind /food/predict
│   ├── scripts/
│   │   ├── importFoodNutritionReference.js   # Seeds food_nutrition_reference
│   │   └── importMealCombinations.js         # Seeds meal_combinations
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── exerciseRoutes.js
│   │   ├── foodRoutes.js
│   │   └── progressRoutes.js
│   ├── .env.example
│   ├── package.json
│   └── server.js                 # Express app entry point
│
└── Frontend/
    ├── public/
    │   ├── image/
    │   │   ├── background.png    # Full-page background image
    │   │   └── logo.png
    │   └── index.html
    ├── src/
    │   ├── components/
    │   │   ├── Layout.tsx                  # Wraps pages with Navbar
    │   │   ├── Navbar.tsx                  # Top navigation with glassmorphism styling
    │   │   ├── ProtectedRoute.tsx          # Auth guard component
    │   │   ├── FoodAutocompleteInput.tsx   # Debounced reference-table autocomplete + servings-scaled autofill
    │   │   └── SuggestMealPanel.tsx        # "Suggest a meal" / "Surprise me" UI
    │   ├── context/
    │   │   └── AuthContext.tsx    # Global auth state (user + token)
    │   ├── pages/
    │   │   ├── LandingPage.tsx
    │   │   ├── LoginPage.tsx
    │   │   ├── SignupPage.tsx
    │   │   ├── HomePage.tsx           # Dashboard
    │   │   ├── FoodPage.tsx           # Food tracker
    │   │   ├── FoodDatabasePage.tsx   # Food Database — browse/search/sort the reference table
    │   │   ├── ExercisePage.tsx       # Exercise library + workout logger
    │   │   └── ProfilePage.tsx        # Profile editor
    │   ├── services/
    │   │   └── api.ts             # All Axios API calls, grouped by domain
    │   ├── types/
    │   │   └── index.ts           # Shared TypeScript interfaces
    │   ├── App.tsx                # Routes definition
    │   └── index.css              # Global styles
    ├── .env.example
    └── package.json
```

---

## Database Schema

Seven tables power the application:

**`users`** — Stores user profile, fitness metrics, and auto-calculated targets (BMR, daily calories, daily protein).

**`foods`** — Food log entries linked to a user; stores macros (calories, protein, carbs, fats), meal type, and date.

**`exercise`** — Static exercise library (seeded on first run); stores exercise type/category, name, image URL, target muscles, equipment, and difficulty.

**`workout_logs`** — User workout entries: links a user to an exercise, with sets, reps, weight, and date.

**`weight_logs`** — Daily body weight entries, one row per user per date (enforced by UNIQUE constraint).

**`daily_calorie_tracking`** — Auto-generated daily rows tracking target, consumed, remaining, and actual deficit. One row per user per date (enforced by UNIQUE constraint). Populated by a daily cron job (23:59) and on-demand via backfill on dashboard load.

**`weight_history`** — Snapshots created when the user clicks **Update Weight**: stores week range, old/new weight, accumulated calorie deficit, and weight change.

Two additional reference tables (not user-owned — shared, read-only lookup data) back the Food Tracker's autofill, the Suggest-a-Meal feature, and the Food Database page:

**`food_nutrition_reference`** — ~290 seeded foods with full nutrition data: macros (calories, protein, carbs, fat, fiber, sugar, saturated fat), micronutrients (sodium, potassium, calcium, iron, magnesium, phosphorus, zinc), and vitamins (A, B1, B2, B3, B5, B6, B9, B12, C, D, E, K). Unique on `(food_name, serving_quantity)`.

**`meal_combinations`** / **`meal_combination_items`** — Seeded food combinations per meal type (breakfast/lunch/dinner/snack), each linking back to `food_nutrition_reference` rows via a quantity multiplier, used by the Suggest-a-Meal feature.

Indexes are created on `(user_id, date)` for foods and workout_logs, and `exercise_type` for fast category filtering.

---

## API Reference

All endpoints are prefixed with `/api`. Protected endpoints require the `Authorization: Bearer <token>` header.

### Auth — `/api/auth`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/signup` | ❌ | Register a new user; returns JWT |
| POST | `/login` | ❌ | Login; returns JWT |
| GET | `/profile` | ✅ | Get current user profile |
| PUT | `/profile` | ✅ | Update profile; recalculates BMR/targets |

### Food — `/api/food`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/predict?q=` | ✅ | Fuzzy-match a typed food name against `food_nutrition_reference`; returns a confident prediction or ranked candidate matches |
| GET | `/search?q=` | ✅ | Live autocomplete — up to 10 ranked matches from `food_nutrition_reference` |
| GET | `/reference?search=&sortBy=&sortDir=&page=&pageSize=` | ✅ | Paginated/sortable/searchable browse of the full `food_nutrition_reference` table (powers the Food Database page) |
| GET | `/reference/:id` | ✅ | Full nutrition detail (all ~25 fields) for one reference food |
| GET | `/suggest?mealType=&targetCalories=&targetProtein=&exclude=` | ✅ | Best-match seeded meal combination for a meal type against remaining targets |
| GET | `/random?mealType=` | ✅ | A random seeded meal combination for a meal type, ignoring targets |
| POST | `/add` | ✅ | Log a food entry |
| GET | `/today` | ✅ | Today's food log + daily totals |
| GET | `/history` | ✅ | Full food history grouped by date |
| GET | `/date/:date` | ✅ | Food log for a specific date (`YYYY-MM-DD`) |
| PUT | `/:id` | ✅ | Edit a food entry |
| DELETE | `/:id` | ✅ | Delete a food entry |

### Exercise — `/api/exercise`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/categories` | ❌ | List all muscle group categories |
| GET | `/list?type=` | ❌ | List exercises, optionally filtered by type |
| GET | `/:id` | ❌ | Get a single exercise by ID |
| POST | `/workout/add` | ✅ | Log a workout entry |
| GET | `/workout/today` | ✅ | Today's workout log |
| GET | `/workout/history` | ✅ | Full workout history |
| GET | `/workout/progress/:exercise_id` | ✅ | Progress history for a specific exercise |
| DELETE | `/workout/:id` | ✅ | Delete a workout entry |

### Dashboard — `/api`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/dashboard` | ✅ | Full dashboard payload (today + weekly charts) |
| GET | `/report/weekly` | ✅ | 7-day nutrition, workout, and weight report |
| POST | `/weight/log` | ✅ | Log today's body weight |
| GET | `/weight/history` | ✅ | Full weight log history |

### Progress — `/api/progress`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/weekly` | ✅ | Current week daily calorie tracking + last week summary + after-update report |
| GET | `/history` | ✅ | Weight history (last 20 entries) |
| POST | `/log-today` | ✅ | Manually log today's tracking row |
| POST | `/apply-weekly` | ✅ | Apply accumulated deficit → calculate weight change, recalculate targets, save snapshot |

### Health Check
```
GET /api/health
```

---

## Getting Started

### Prerequisites
- Node.js v18 or higher
- npm v9 or higher
- A PostgreSQL database (local or cloud — [Neon](https://neon.tech) recommended for free managed hosting)

---

### Backend Setup

1. Navigate to the backend folder:
   ```bash
   cd Fittracker/Backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your environment file:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your own values (see [Environment Variables](#environment-variables)).

4. Run the database schema to create all tables and seed exercise data:
   ```sql
   -- Connect to your PostgreSQL database and run:
   \i models/schema.sql
   ```
   Or paste the contents of `models/schema.sql` directly into your DB console (e.g., Neon's SQL editor).

   Then create the food reference tables and seed them (powers autofill, Suggest-a-Meal, and the Food Database page):
   ```sql
   \i models/food_nutrition_reference_schema.sql
   \i models/meal_combinations_schema.sql
   ```
   ```bash
   node scripts/importFoodNutritionReference.js
   node scripts/importMealCombinations.js
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```
   The server starts at `http://localhost:5000`.  
   Health check: `http://localhost:5000/api/health`

---

### Frontend Setup

1. Navigate to the frontend folder:
   ```bash
   cd Fittracker/Frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your environment file:
   ```bash
   cp .env.example .env
   ```
   Set `REACT_APP_API_URL` to your backend URL.

4. Start the development server:
   ```bash
   npm start
   ```
   The app opens at `http://localhost:3000`.

5. To create a production build:
   ```bash
   npm run build
   ```

---

## Environment Variables

### Backend — `Backend/.env`

| Variable | Description | Example |
|---|---|---|
| `PORT` | Port the server listens on | `5000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/dbname?sslmode=require` |
| `JWT_SECRET` | Secret key for signing JWTs | `your_strong_random_secret` |
| `JWT_EXPIRES_IN` | JWT expiry duration | `7d` |

### Frontend — `Frontend/.env`

| Variable | Description | Example |
|---|---|---|
| `REACT_APP_API_URL` | Base URL of the backend API | `http://localhost:5000/api` |

> **Important:** Never commit your actual `.env` files to version control. Both `.env.example` files are safe to commit as templates.

---

## Deployment

### Backend on Render

1. Create a new **Web Service** on [Render](https://render.com) and connect your repository.
2. Set the root directory to `Backend/`.
3. Set the build command to `npm install` and the start command to `node server.js`.
4. Add all environment variables from `Backend/.env` in the Render dashboard.
5. Update the CORS allowed origins in `server.js` to include your Vercel frontend URL:
   ```js
   origin: ['https://your-app.vercel.app']
   ```

### Frontend on Vercel

1. Import your repository into [Vercel](https://vercel.com).
2. Set the root directory to `Frontend/`.
3. Vercel auto-detects Create React App; the build command is `npm run build` and the output directory is `build/`.
4. Add `REACT_APP_API_URL` as an environment variable pointing to your Render backend URL.

> **Note on SMTP / Email:** Render's free tier blocks outbound SMTP ports (465, 587). If you add email features (OTP, notifications), use the [Resend](https://resend.com) API over HTTPS instead of Nodemailer/Gmail SMTP.

---

## Known Issues & Bug Fixes

The following bugs were identified and resolved during development — documented here for reference:

**Route ordering conflict in Express**  
`GET /exercise/workout/today` was being matched by the `/:id` catch-all route (with `id = "workout"`), causing silent DB lookup failures. Fixed by placing all `/workout/*` sub-routes before the `/:id` parameterized route.

**PostgreSQL `NUMERIC` type coercion**  
Aggregation queries (e.g., `SUM(calories)`) return `NUMERIC` from PostgreSQL, which `pg` serializes as a string in Node.js. Fixed by adding `::float` casts in SQL and explicit `parseFloat()` calls in JavaScript, plus `COALESCE(..., 0)` to handle null results when no rows exist.

**Frontend field name mismatch**  
The frontend was sending `category` (capitalized) in food POST requests, but the backend expected `meal_type` (lowercase). Fixed in `api.ts` by mapping `data.category.toLowerCase()` to `meal_type` before sending.

**Workout API path mismatch**  
The frontend was calling `/workout/add` but routes are mounted under `/api/exercise`, making the correct path `/exercise/workout/add`. Fixed in `api.ts`.

**Google Drive image URLs**  
Exercise images stored as Google Drive sharing URLs (`/file/d/{ID}/view`) are not embeddable in `<img>` tags. Fixed by converting all URLs to the direct embed format: `https://drive.google.com/uc?export=view&id={ID}`.

**JWT middleware mount conflict**  
Applying `authMiddleware` globally via `router.use()` before public routes caused 401 errors on unauthenticated endpoints. Fixed by applying the middleware only to protected routes.

**Double-counted built-in deficit**  
The `actual_deficit` formula was adding `500 + remaining` for weight_loss, but the daily target already has a 500 kcal deficit (maintenance - 500). Fixed: `actual_deficit = remaining` (no extra +500). The +500 is added back only in weight-change calculations (7700 kcal/kg formula) via `+ 500 * days`.

**Factor-100 frontend display bug**  
The total deficit sum was being divided by 100 before rendering, showing +21 instead of +2103. Fixed by removing the spurious division.

**Date timezone shifting**  
PostgreSQL `DATE` columns returned as JS `Date` objects were serialised to UTC ISO strings, shifting dates by 1 day for non-UTC timezones. Fixed by using `TO_CHAR(date, 'YYYY-MM-DD') AS date` in all queries.

**`NaN` in food UPDATE query**  
The frontend edit payload omits `carbs`/`fats`, causing `parseFloat(undefined)` to return `NaN`. The `??` operator doesn't catch `NaN` (not nullish), so `NaN` was passed to SQL. Fixed by moving `??` before `parseFloat`: `parseFloat(carbs ?? current.carbs)`.

**Missing `updated_at` column in `foods` table**  
The `updateFood` query referenced `updated_at = NOW()`, but the `foods` table has no `updated_at` column. Fixed by removing the column reference from the UPDATE query.

**Missing food history for days with no tracking entry**  
The `daily_calorie_tracking` table could have gaps if the cron job failed. Fixed with a backfill loop in `getWeeklyProgress` that creates tracking rows for any day in the current week that has food data but no tracking entry.

**Zero-calorie phantom deficit**  
A tracking row with `consumed_calories = 0` created a phantom +target deficit (e.g. +1334) for today when no food was logged yet. Fixed by deleting stale zero-calorie rows in `logTodayForUser` when `consumed === 0`.

---

## Author

Built by **Kavin** — B.E. Computer Science & Engineering, Coimbatore Institute of Technology (CIT), 2026.
