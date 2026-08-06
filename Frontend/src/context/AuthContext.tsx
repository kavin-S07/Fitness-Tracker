// ============================================================
// src/context/AuthContext.tsx
// ============================================================
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authAPI } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (u: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Used once, wrapping the whole app in App.tsx.
// Provides the logged-in user's info and auth actions (login/logout) to every page.
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('ft_token'));
  const [loading, setLoading] = useState(true);

  // On mount, restore session
  useEffect(() => {
    const stored = localStorage.getItem('ft_token');
    if (stored) {
      authAPI.getProfile()
        .then((res) => setUser(res.data.user))
        .catch(() => {
          localStorage.removeItem('ft_token');
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Used when a user submits the login form.
  // Logs the user in, then saves the token and user info for the whole app to use.
  const login = async (email: string, password: string) => {
    const res = await authAPI.login(email, password);
    const { token: t, user: u } = res.data;
    localStorage.setItem('ft_token', t);
    setToken(t);
    setUser(u);
  };

  // Used when a user clicks "Logout".
  // Clears the saved token and user info, ending the session.
  const logout = () => {
    localStorage.removeItem('ft_token');
    setToken(null);
    setUser(null);
  };

  // Used when a user updates their profile (e.g. weight, goal).
  // Merges the changed fields into the currently stored user info.
  const updateUser = (partial: Partial<User>) =>
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Used by any page or component that needs the logged-in user's info or auth actions.
// Gives easy access to the AuthContext (user, token, login, logout, updateUser).
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
