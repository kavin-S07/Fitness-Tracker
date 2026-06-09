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

### Food Tracker
- Log meals with food name, calories, protein, carbs, fats, meal type (Breakfast / Lunch / Dinner / Snack), and date
- View today's food log grouped by meal type
- Browse food history by date
- Delete individual food entries
- Running daily totals for calories and protein

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
- Weight progress snapshot for the week

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
│   │   ├── authController.js     # Signup, login, profile CRUD + BMR calc
│   │   ├── dashboardController.js# Dashboard summary, weekly report, weight log
│   │   ├── exerciseController.js # Exercise library + workout log CRUD
│   │   └── foodController.js     # Food log CRUD
│   ├── middleware/
│   │   └── auth.js               # JWT verification middleware
│   ├── models/
│   │   └── schema.sql            # Full DB schema + exercise seed data
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── exerciseRoutes.js
│   │   └── foodRoutes.js
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
    │   │   ├── Layout.tsx         # Wraps pages with Navbar
    │   │   ├── Navbar.tsx         # Top navigation with glassmorphism styling
    │   │   └── ProtectedRoute.tsx # Auth guard component
    │   ├── context/
    │   │   └── AuthContext.tsx    # Global auth state (user + token)
    │   ├── pages/
    │   │   ├── LoginPage.tsx
    │   │   ├── SignupPage.tsx
    │   │   ├── HomePage.tsx       # Dashboard
    │   │   ├── FoodPage.tsx       # Food tracker
    │   │   ├── ExercisePage.tsx   # Exercise library + workout logger
    │   │   └── ProfilePage.tsx    # Profile editor
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

Five tables power the application:

**`users`** — Stores user profile, fitness metrics, and auto-calculated targets (BMR, daily calories, daily protein).

**`foods`** — Food log entries linked to a user; stores macros (calories, protein, carbs, fats), meal type, and date.

**`exercise`** — Static exercise library (seeded on first run); stores exercise type/category, name, image URL, target muscles, equipment, and difficulty.

**`workout_logs`** — User workout entries: links a user to an exercise, with sets, reps, weight, and date.

**`weight_logs`** — Daily body weight entries, one row per user per date (enforced by UNIQUE constraint).

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
| POST | `/add` | ✅ | Log a food entry |
| GET | `/today` | ✅ | Today's food log + daily totals |
| GET | `/history` | ✅ | Full food history grouped by date |
| GET | `/date/:date` | ✅ | Food log for a specific date (`YYYY-MM-DD`) |
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

---

## Author

Built by **Kavin** — B.E. Computer Science & Engineering, Coimbatore Institute of Technology (CIT), 2026.
