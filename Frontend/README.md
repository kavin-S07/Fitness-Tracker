# 🏋️ Fitness Tracker – Frontend

React + TypeScript frontend for the Fitness Tracker application.

## Project Structure

```
src/
├── components/
│   ├── Navbar.tsx          ← Top navigation bar with logo
│   ├── Layout.tsx          ← Page wrapper (Navbar + children)
│   └── ProtectedRoute.tsx  ← JWT-guard for private routes
├── context/
│   └── AuthContext.tsx     ← Global auth state (login/logout/user)
├── pages/
│   ├── LoginPage.tsx       ← Login with background image
│   ├── SignupPage.tsx      ← 3-step signup (Account → Body → Goal)
│   ├── HomePage.tsx        ← Dashboard with charts, stats, weight log
│   ├── FoodPage.tsx        ← Food tracker (add/delete by category)
│   ├── ExercisePage.tsx    ← Gym tracker (browse exercises, log sets)
│   └── ProfilePage.tsx     ← Profile view/edit + weight history chart
├── services/
│   └── api.ts              ← All Axios API calls to backend
├── types/
│   └── index.ts            ← Shared TypeScript interfaces
├── App.tsx                 ← Router setup
├── index.tsx               ← Entry point
└── index.css               ← Design system (CSS variables, utilities)
```

## Setup

### 1. Place your images
```
public/
└── image/
    ├── logo.png        ← Your Fitness Tracker logo
    └── background.png  ← Your gym background image
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure backend URL
```bash
cp .env.example .env
# Edit .env and set REACT_APP_API_URL=http://localhost:5000/api
```

### 4. Start the app
```bash
npm start
```

The app will open at **http://localhost:3000**

## Pages & Routes

| Route       | Page            | Protected |
|-------------|-----------------|-----------|
| `/login`    | Login           | No        |
| `/signup`   | Signup (3-step) | No        |
| `/home`     | Dashboard       | ✅ Yes     |
| `/food`     | Food Tracker    | ✅ Yes     |
| `/exercise` | Gym Tracker     | ✅ Yes     |
| `/profile`  | Profile         | ✅ Yes     |

## Features

- **Login / 3-step Signup** with your background image
- **Dashboard**: Calorie/protein progress bars, weekly charts (recharts), weight logging, weekly report modal
- **Food Tracker**: Add meals by category (Breakfast/Lunch/Dinner/Snacks), view macro summary per day, delete entries
- **Gym Tracker**: Browse exercises by muscle group, log sets with reps/weight, view today's workout, delete logs
- **Profile**: View all stats + calculated targets (BMR, daily calories/protein), edit weight/goal/activity, 30-day weight history chart
- **JWT auth** persisted in localStorage, auto-restored on page reload

## Tech Stack
- React 18 + TypeScript
- React Router v6
- Axios (API calls)
- Recharts (charts)
- CSS Custom Properties (design system, no external UI library)
