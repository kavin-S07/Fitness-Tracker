// ============================================================
// src/components/Layout.tsx
// ============================================================
import React from 'react';
import Navbar from './Navbar';

// Used to wrap every protected page (Home, Food, Exercise, Profile, etc.).
// Adds the shared navbar and background around the page's content.
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
    <Navbar />
    <main>{children}</main>
  </div>
);

export default Layout;
