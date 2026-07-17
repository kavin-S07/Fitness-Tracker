<div align="center">

# 🏋️ FitnessTracker

### Train Smart. Eat Right. Hit Your Goal.

A full-stack fitness companion that calculates your personalized calorie & protein targets, then helps you log food, track workouts, monitor body weight, and follow your progress with weekly reports and a calorie-deficit engine — all in one clean dashboard.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![JWT](https://img.shields.io/badge/Auth-JWT-black?logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](#-license)

[Features](#-key-features) • [Tech Stack](#-tech-stack) • [Architecture](#-project-architecture) • [Setup](#-installation--setup) • [API](#-api-endpoints) • [Deployment](#-deployment)

</div>

---

## 📖 Overview

**FitnessTracker** is a personalized fitness companion that calculates your daily calorie and protein targets using the **Mifflin‑St Jeor BMR formula**, adjusted for your activity level and goal (weight loss, weight gain, or maintenance). Once signed up, you can log every meal, every workout set, and your daily body weight — and watch your progress unfold across charts, a calorie‑deficit engine, and automated weekly reports.

The app ships with a seeded exercise library, a ~290-item nutrition reference database with full macro/micronutrient/vitamin data, autocomplete-driven food logging, and a "Suggest a Meal" engine that recommends pre-computed food combinations matched to your remaining daily targets.

---

## ✨ Key Features

### 🔐 Authentication & Profile
- Secure signup with full onboarding — age, gender, weight, height, fitness goal, gym status, and activity level
- JWT-based authentication (`Authorization: Bearer <token>`), token persisted in `localStorage`
- Auto-calculated **BMR**, **maintenance calories**, **daily calorie target**, and **daily protein target** on signup, login, and every profile update
- Editable profile page — updating weight/goal/activity instantly recalculates every target

### 🏠 Smart Dashboard
- Today's calories & protein consumed vs. target, with live remaining amounts
- Today's workout summary — total sets logged and muscle groups trained
- 7-day calorie & protein intake charts and a 7-day workout volume chart (Recharts)
- Current weight vs. target weight, with BMI and weight-remaining display
- **After Last Update Report** — previous weight, current weight, deficit accumulated since the last update, days since update, and a predicted weight

### 🔥 Calorie Deficit Tracking Engine
- Automatic daily snapshot of target / consumed / remaining / actual deficit (`daily_calorie_tracking`), written by a nightly cron job at **23:59**
- Self-healing backfill — any day this week with logged food but no tracking row is generated on demand
- Phantom zero-calorie rows are cleaned up automatically
- Weekly projected weight change using the **7,700 kcal ≈ 1 kg** rule

### ⚖️ Weight Update Workflow
- **Update Weight** action snapshots the week's accumulated deficit into `weight_history`, recalculates a new BMR/maintenance/targets, and resets the tracking cycle
- A separate Monday-00:00 cron job performs the same rollover automatically for every active user

### 🥗 Food Tracker
- Log meals with name, calories, protein, carbs, fats, fiber, meal type (Breakfast / Lunch / Dinner / Snack), and date
- **Live autocomplete autofill** — typing a food name queries `food_nutrition_reference` (debounced) and offers ranked matches; picking one pre-fills macros, scaled live by a servings multiplier, while remaining fully editable
- **Predictive fallback** (`/food/predict`) — server-side fuzzy matching when a user types a complete name without selecting a suggestion
- **Suggest a Meal panel** — recommends a best-fit pre-seeded food combination for a meal type against your remaining calorie/protein targets, with **Next combination** and **Surprise me** (fully random) options
- Daily log grouped by meal type with running totals, full history by date, and inline edit/delete

### 📖 Food Database
- Standalone browsing page (`/food-database`) over the full nutrition reference table, independent of logging
- Debounced search by food name, resetting to page 1 per query
- Sortable table (Name, Calories, Protein, Carbs, Fat) with persistent sort across pagination
- Server-side pagination (20/page, capped at 100) with `COUNT(*) OVER()` for total rows
- Row-click detail view exposing all ~25 nutrition fields grouped into **Macros**, **Micronutrients**, and **Vitamins**

### 💪 Exercise / Gym Tracker
- Seeded exercise library grouped by muscle group (Chest, Back, Biceps, Shoulders, and more)
- Each exercise card shows target muscles, equipment, difficulty, and a demo image
- Log workout sets (reps × weight) per exercise per date
- Today's workout log, full workout history, and an all-time workout feed (configurable day range)
- Per-exercise progressive-overload chart via `/workout/progress/:exercise_id`
- Delete individual workout entries

### 📈 Weekly Report
- 7-day nutrition summary (avg calories/protein vs. targets, days logged)
- 7-day workout summary (active days, total sets, muscle groups hit, strongest muscle, missed days)
- Weight section — current/start/end weight, net change, and progress status vs. target

---

## 🛠 Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | UI framework |
| **TypeScript** | Type safety across components, services, and API contracts |
| **React Router v6** | Client-side routing with protected routes |
| **Axios** | HTTP client with a JWT request interceptor |
| **Recharts** | Dashboard charts and data visualizations |
| **Custom CSS** | Hand-built light theme, no CSS framework |

### Backend
| Technology | Purpose |
|---|---|
| **Node.js** | Runtime |
| **Express 4** | REST API framework |
| **PostgreSQL** | Relational database |
| **pg (node-postgres)** | Database driver / connection pooling |
| **bcryptjs** | Password hashing |
| **jsonwebtoken** | JWT issuing & verification |
| **node-cron** | Scheduled deficit-tracking & weekly weight-update jobs |
| **csv-parse** | Parsing seed data (nutrition & meal-combo CSVs) |
| **dotenv** | Environment variable management |
| **cors** | Cross-origin resource sharing |

### Database
Seven application tables (`users`, `foods`, `exercise`, `workout_logs`, `weight_logs`, `daily_calorie_tracking`, `weight_history`) plus three shared reference tables (`food_reference`, `food_nutrition_reference`, `meal_combinations` / `meal_combination_items`) — see [Database Schema](#-database-schema).

---

## 🏗 Project Architecture

```
┌─────────────────┐        HTTPS / JSON        ┌──────────────────┐        SQL        ┌──────────────┐
│   React (SPA)    │ ───────────────────────▶ │  Express REST API │ ────────────────▶ │  PostgreSQL   │
│  Vercel-hosted    │ ◀─────────────────────── │   Render-hosted    │ ◀──────────────── │  Neon-hosted  │
└─────────────────┘      JWT Bearer token      └──────────────────┘                    └──────────────┘
                                                        │
                                                        ▼
                                          ┌───────────────────────────┐
                                          │ node-cron scheduled jobs   │
                                          │ • 23:59 daily deficit log  │
                                          │ • Mon 00:00 weekly rollover│
                                          └───────────────────────────┘
```

- **Frontend** is a single-page app: `AuthContext` holds the session, `ProtectedRoute` guards authenticated pages, and `services/api.ts` centralizes every backend call behind typed helpers (`authAPI`, `dashboardAPI`, `foodAPI`, `exerciseAPI`, `progressAPI`).
- **Backend** follows a classic layered structure — `routes` → `controllers` → `pool.query` (raw SQL, no ORM) — with a `services/` layer for the fuzzy food-matching logic and a `utils/metrics.js` module centralizing every BMR/TDEE/protein calculation so it's never duplicated across controllers.
- **Reference data** (nutrition facts, meal combinations) is seeded once via one-off scripts in `scripts/` and then queried read-only at runtime.

---

## 📁 Folder Structure

```
FitnessTracker/
├── BackendCode/
│   ├── config/
│   │   └── db.js                        # PostgreSQL connection pool
│   ├── controllers/
│   │   ├── authController.js            # Signup, login, profile CRUD + metrics
│   │   ├── dashboardController.js       # Dashboard summary, weekly report, weight log
│   │   ├── exerciseController.js        # Exercise library + workout log CRUD
│   │   ├── foodController.js            # Food log CRUD
│   │   ├── foodPredictController.js     # Fuzzy-match autofill fallback (/food/predict)
│   │   ├── foodReferenceController.js   # Autocomplete search, paginated list, detail view
│   │   ├── suggestionController.js      # "Suggest a meal" / "Surprise me"
│   │   └── progressController.js        # Deficit tracking, weight-update workflow
│   ├── data/                            # Seed CSVs (nutrition + meal combos)
│   ├── middleware/
│   │   └── auth.js                      # JWT verification middleware
│   ├── models/
│   │   ├── schema.sql                   # Core schema + exercise seed data
│   │   ├── food_reference_schema.sql
│   │   ├── food_nutrition_reference_schema.sql
│   │   └── meal_combinations_schema.sql
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── exerciseRoutes.js
│   │   ├── foodRoutes.js
│   │   └── progressRoutes.js
│   ├── scripts/
│   │   ├── importFoodReference.js
│   │   ├── importFoodNutritionReference.js
│   │   └── importMealCombinations.js
│   ├── services/
│   │   ├── foodMatchService.js          # Fuzzy-matching logic behind /food/predict
│   │   └── nutritionService.js
│   ├── utils/
│   │   └── metrics.js                   # Centralized BMR / TDEE / protein calculations
│   ├── .env.example
│   ├── package.json
│   └── server.js                        # Express entry point + cron jobs
│
└── FrontendCode/
    ├── components/
    │   ├── Layout.tsx                   # Wraps authenticated pages with Navbar
    │   ├── Navbar.tsx                   # Top navigation
    │   ├── ProtectedRoute.tsx           # Auth guard
    │   ├── FoodAutocompleteInput.tsx    # Debounced reference search + servings-scaled autofill
    │   └── SuggestMealPanel.tsx         # "Suggest a meal" / "Surprise me" UI
    ├── context/
    │   └── AuthContext.tsx              # Global auth state (user + token)
    ├── pages/
    │   ├── LandingPage.tsx
    │   ├── LoginPage.tsx
    │   ├── SignupPage.tsx
    │   ├── HomePage.tsx                 # Dashboard
    │   ├── FoodPage.tsx                 # Food tracker
    │   ├── FoodDatabasePage.tsx         # Standalone nutrition reference browser
    │   ├── ExercisePage.tsx             # Exercise library + workout logger
    │   └── ProfilePage.tsx              # Profile editor
    ├── services/
    │   └── api.ts                       # All Axios calls, grouped by domain
    ├── types/
    │   └── index.ts                     # Shared TypeScript interfaces
    ├── App.tsx                          # Route definitions
    └── index.css                        # Global styles
```

---

## ⚙️ Installation & Setup

### Prerequisites
- **Node.js** v18+
- **npm** v9+
- A **PostgreSQL** database (local, or a free managed instance on [Neon](https://neon.tech))

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd FitnessTracker
```

### 2. Backend setup
```bash
cd BackendCode
npm install
cp .env.example .env   # then fill in your own values — see Environment Variables below
```

Create the schema and seed the reference data:
```sql
-- Run against your PostgreSQL database:
\i models/schema.sql
\i models/food_reference_schema.sql
\i models/food_nutrition_reference_schema.sql
\i models/meal_combinations_schema.sql
```
```bash
node scripts/importFoodReference.js
node scripts/importFoodNutritionReference.js
node scripts/importMealCombinations.js
```

> 💡 Core tables and the meal-combination tables are also auto-created on server boot via `IF NOT EXISTS` guards in `server.js`, so running the SQL by hand is a safety net rather than a strict requirement — but the **import scripts must be run once** to actually populate the reference data.

### 3. Frontend setup
```bash
cd ../FrontendCode
npm install
```
Set `REACT_APP_API_URL` in your frontend `.env` to point at the backend (see below).

---

## 🔑 Environment Variables

### Backend — `BackendCode/.env`
| Variable | Description | Example |
|---|---|---|
| `PORT` | Port the Express server listens on | `5000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/dbname?sslmode=require` |
| `JWT_SECRET` | Secret used to sign JWTs | `a-long-random-string` |
| `JWT_EXPIRES_IN` | JWT expiry duration | `7d` |
| `FRONTEND_URL` | Deployed frontend origin, allow-listed by CORS | `https://your-app.vercel.app` |

### Frontend — `FrontendCode/.env`
| Variable | Description | Example |
|---|---|---|
| `REACT_APP_API_URL` | Base URL of the backend API | `http://localhost:5000/api` |

> ⚠️ **Never commit real `.env` values.** Only commit `.env.example` templates with placeholder values.

---

## ▶️ Running the Project Locally

```bash
# Terminal 1 — backend
cd BackendCode
npm run dev        # http://localhost:5000  (auto-restarts on file changes via --watch)

# Terminal 2 — frontend
cd FrontendCode
npm start           # http://localhost:3000
```

Health check: `GET http://localhost:5000/api/health`

---

## 📜 Available Scripts

### Backend (`BackendCode/package.json`)
| Script | Description |
|---|---|
| `npm start` | Run the server with plain `node` |
| `npm run dev` | Run with `node --watch` for auto-reload during development |
| `npm run import:food-reference` | Seed the legacy `food_reference` fuzzy-match table |
| `npm run import:food-nutrition-reference` | Seed the `food_nutrition_reference` table (autocomplete, Food Database) |
| `npm run import:meal-combinations` | Seed `meal_combinations` / `meal_combination_items` |

### Frontend
| Script | Description |
|---|---|
| `npm start` | Run the CRA development server |
| `npm run build` | Create a production build |

---

## 🔌 API Endpoints

All endpoints are prefixed with `/api`. Protected endpoints require an `Authorization: Bearer <token>` header.

### Auth — `/api/auth`
| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| POST | `/signup` | ❌ | Register a new user, returns a JWT |
| POST | `/login` | ❌ | Authenticate, returns a JWT |
| GET | `/profile` | ✅ | Get the current user's profile (targets recalculated live) |
| PUT | `/profile` | ✅ | Update profile fields; recalculates BMR/targets |

### Food — `/api/food`
| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| GET | `/predict?q=` | ✅ | Server-side fuzzy match for a typed food name |
| GET | `/search?q=` | ✅ | Live autocomplete — up to 10 ranked matches |
| GET | `/reference?search=&sortBy=&sortDir=&page=&pageSize=` | ✅ | Paginated/sortable/searchable browse (Food Database page) |
| GET | `/reference/:id` | ✅ | Full nutrition detail for one reference item |
| GET | `/suggest?mealType=&targetCalories=&targetProtein=&exclude=` | ✅ | Best-match seeded meal combination |
| GET | `/random?mealType=` | ✅ | Random seeded meal combination |
| POST | `/add` | ✅ | Log a food entry |
| GET | `/today` | ✅ | Today's food log + totals |
| GET | `/history` | ✅ | Full food history grouped by date |
| GET | `/date/:date` | ✅ | Food log for a specific date (`YYYY-MM-DD`) |
| PUT | `/:id` | ✅ | Edit a food entry |
| DELETE | `/:id` | ✅ | Delete a food entry |

### Exercise — `/api/exercise`
| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| GET | `/categories` | ❌ | List muscle-group categories |
| GET | `/list?type=` | ❌ | List exercises, optionally filtered by type |
| POST | `/workout/add` | ✅ | Log a workout (accepts a scalar entry or an array of sets) |
| GET | `/workout/today` | ✅ | Today's workout log |
| GET | `/workout/history` | ✅ | 30-day workout history, grouped by date |
| GET | `/workout/progress/:exercise_id` | ✅ | Progressive-overload history for one exercise |
| GET | `/workout/all?days=` | ✅ | All workout logs within the last N days (default 90) |
| DELETE | `/workout/:id` | ✅ | Delete a workout entry |
| GET | `/:id` | ❌ | Get a single exercise by id *(kept last — catch-all)* |

### Dashboard — `/api`
| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| GET | `/dashboard` | ✅ | Full dashboard payload (today + 7-day charts) |
| GET | `/report/weekly` | ✅ | 7-day nutrition, workout, and weight report |
| POST | `/weight/log` | ✅ | Log today's body weight |
| GET | `/weight/history` | ✅ | Full weight-log history |

### Progress — `/api/progress`
| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| GET | `/weekly` | ✅ | Current-week deficit tracking + after-update report |
| GET | `/history` | ✅ | Last 20 weight-history entries |
| POST | `/log-today` | ✅ | Manually log today's tracking row |
| POST | `/apply-weekly` | ✅ | Snapshot deficit → weight change → recalculated targets |

### Health Check
```http
GET /api/health
```

---

## 🔐 Authentication & Authorization Flow

1. **Signup / Login** — `bcryptjs` hashes the password on signup; `login` compares the hash and, on success, signs a JWT (`{ id, email, name }`) with `JWT_SECRET`, expiring per `JWT_EXPIRES_IN` (default `7d`).
2. **Token storage** — the frontend stores the token in `localStorage` under `ft_token`.
3. **Request signing** — an Axios request interceptor in `services/api.ts` automatically attaches `Authorization: Bearer <token>` to every outgoing request.
4. **Route protection**
   - **Frontend**: `<ProtectedRoute>` checks `AuthContext` and redirects unauthenticated users to `/login`.
   - **Backend**: `middleware/auth.js` verifies the JWT on every protected route and attaches the decoded payload to `req.user`. Public endpoints (signup, login, exercise library browsing) intentionally skip this middleware.
5. **Session restore** — on app load, `AuthContext` calls `GET /auth/profile` with the stored token to rehydrate the user session; an invalid/expired token clears local storage and logs the user out.
6. **Target recalculation** — the backend recalculates BMR/maintenance/daily calorie/protein targets on login, on profile fetch, and on profile update, so targets are always in sync with the user's latest weight and goal.

---

## 🗄 Database Schema

**Seven** application tables plus **three** shared read-only reference tables, all in PostgreSQL:

| Table | Purpose |
|---|---|
| `users` | Profile, fitness metrics, and auto-calculated targets (BMR, maintenance calories, daily calorie/protein targets) |
| `foods` | Food log entries — macros, meal type, date, linked to a user |
| `exercise` | Seeded exercise library — type, name, image, target muscle, equipment, difficulty |
| `workout_logs` | Workout entries — links a user + exercise with sets/reps/weight/date |
| `weight_logs` | Daily body weight, one row per user per date (`UNIQUE(user_id, log_date)`) |
| `daily_calorie_tracking` | Auto-generated daily deficit snapshot — target/consumed/remaining/actual deficit (`UNIQUE(user_id, date)`), written by a nightly cron job |
| `weight_history` | Snapshots created on weekly rollover — week range, old/new weight, accumulated deficit, weight change |
| `food_reference` | Legacy lookup dataset backing the `/food/predict` fuzzy-match fallback |
| `food_nutrition_reference` | ~290 seeded foods with full macro, micronutrient, and vitamin data — powers autocomplete, Suggest-a-Meal, and the Food Database page |
| `meal_combinations` / `meal_combination_items` | Pre-generated food combinations per meal type, each linking back to `food_nutrition_reference` rows |

**Indexes:** `(user_id, date)` on `foods` and `workout_logs`, `exercise_type` on `exercise`, a trigram GIN index on `food_nutrition_reference.food_name` for fast partial-text search, and a composite index on `meal_combinations(meal_type, total_calories, total_protein)` for suggestion queries.

<details>
<summary><strong>Entity relationship summary</strong></summary>

```
users 1───* foods
users 1───* workout_logs *───1 exercise
users 1───* weight_logs
users 1───* daily_calorie_tracking
users 1───* weight_history
meal_combinations 1───* meal_combination_items *───1 food_nutrition_reference
```

</details>

---

## 🖼 Screenshots

> _Add screenshots or GIFs of the Landing Page, Dashboard, Food Tracker, Food Database, and Exercise Tracker here._

| Landing Page | Dashboard | Food Tracker |
|---|---|---|
| ![Landing Page](./docs/screenshots/landing.png) | ![Dashboard](./docs/screenshots/dashboard.png) | ![Food Tracker](./docs/screenshots/food-tracker.png) |

| Food Database | Exercise Tracker | Profile |
|---|---|---|
| ![Food Database](./docs/screenshots/food-database.png) | ![Exercise Tracker](./docs/screenshots/exercise-tracker.png) | ![Profile](./docs/screenshots/profile.png) |

---

## 🚀 Deployment

### Backend → [Render](https://render.com)
1. Create a new **Web Service** and connect the repository.
2. Set the root directory to `BackendCode/`.
3. Build command: `npm install` — Start command: `node server.js`.
4. Add every variable from [Environment Variables](#-environment-variables) in the Render dashboard.
5. Make sure `FRONTEND_URL` (and/or the `*.vercel.app` regex already whitelisted in `server.js`) matches your deployed frontend origin.

### Frontend → [Vercel](https://vercel.com)
1. Import the repository and set the root directory to `FrontendCode/`.
2. Vercel auto-detects Create React App — build command `npm run build`, output directory `build/`.
3. Add `REACT_APP_API_URL` pointing to your Render backend URL (e.g. `https://your-api.onrender.com/api`).

### Database → [Neon](https://neon.tech)
Run the schema + reference-data seed scripts described in [Installation & Setup](#-installation--setup) against your Neon connection string, then point `DATABASE_URL` at it.

---

## 🔄 Project Workflow

```
Sign up → BMR / targets calculated  →  Log food & workouts daily
                                             │
                                             ▼
                          23:59 cron: daily_calorie_tracking snapshot
                                             │
                                             ▼
                     Monday 00:00 cron OR manual "Update Weight":
                     accumulated deficit → new weight → new targets
                                             │
                                             ▼
                          Dashboard & Weekly Report reflect progress
```

- Everyday use revolves around the **Dashboard** (at-a-glance status), **Food Tracker** (logging + Suggest-a-Meal), and **Exercise Tracker** (workout logging).
- The **deficit-tracking engine** runs quietly in the background — no manual math required — and only surfaces in the **Weekly Report** and **After Last Update** panel.
- **Weight Update** is the explicit checkpoint where accumulated deficit is converted into an actual weight change and fresh targets.

---

## 🔮 Future Improvements

- [ ] Push/email notifications for missed logging days or weekly report availability
- [ ] Social/friends leaderboard and progress sharing
- [ ] Custom exercise creation (beyond the seeded library)
- [ ] Barcode scanning for food logging
- [ ] Mobile app (React Native) sharing the same API
- [ ] Dark mode
- [ ] Export food/workout history to CSV/PDF

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

Please keep backend route ordering conventions (specific routes before parameterized `/:id` catch-alls) and the centralized `utils/metrics.js` calculation logic in mind when contributing to those areas.

---

## 📄 License

This project is licensed under the **MIT License** — feel free to use, modify, and distribute it with attribution.

---

## 👤 Author

Built by **Kavin** — B.E. Computer Science & Engineering, Coimbatore Institute of Technology (CIT), 2026.

<div align="center">

If you found this project useful or interesting, consider giving it a ⭐!

</div>
