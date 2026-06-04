// ============================================================
// src/App.tsx
// ============================================================
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import LoginPage    from './pages/LoginPage';
import SignupPage   from './pages/SignupPage';
import HomePage     from './pages/HomePage';
import FoodPage     from './pages/FoodPage';
import ExercisePage from './pages/ExercisePage';
import ProfilePage  from './pages/ProfilePage';

const App: React.FC = () => {

  useEffect(() => {
    document.body.style.backgroundImage =
      'linear-gradient(rgba(10,14,26,0.6), rgba(26, 26, 27, 0.6)), url(/image/background.png)';
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundRepeat = 'no-repeat';
    document.body.style.backgroundAttachment = 'fixed';
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public */}
          <Route path="/login"  element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Protected */}
          <Route path="/home" element={
            <ProtectedRoute><Layout><HomePage /></Layout></ProtectedRoute>
          } />
          <Route path="/food" element={
            <ProtectedRoute><Layout><FoodPage /></Layout></ProtectedRoute>
          } />
          <Route path="/exercise" element={
            <ProtectedRoute><Layout><ExercisePage /></Layout></ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute><Layout><ProfilePage /></Layout></ProtectedRoute>
          } />

          {/* Default */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;