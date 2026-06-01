// ============================================================
// src/components/Layout.tsx
// ============================================================
import React from 'react';
import Navbar from './Navbar';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
    <Navbar />
    <main>{children}</main>
  </div>
);

export default Layout;
