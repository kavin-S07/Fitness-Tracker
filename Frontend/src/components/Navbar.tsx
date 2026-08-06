// ============================================================
// src/components/Navbar.tsx  –  Solidroad-inspired clean navbar
// ============================================================
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { path: '/home',     label: 'Home',         icon: '⊞' },
  { path: '/food',     label: 'Food Tracker', icon: '🥗' },
  { path: '/food-database', label: 'Food Database', icon: '📖' },
  { path: '/exercise', label: 'Gym Tracker',  icon: '💪' },
  { path: '/profile',  label: 'Profile',      icon: '👤' },
];

// Used at the top of every protected page (rendered inside Layout).
// Shows the site navigation links, the user's name, and the logout button.
const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Used when a user clicks "Sign out" (desktop or mobile menu).
  // Logs the user out and sends them to the login page.
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <>
      <nav style={styles.nav}>
        {/* Brand */}
        <div style={styles.brand} onClick={() => navigate('/')}>
          <div style={styles.brandIcon}>🏃</div>
          <span style={styles.brandText}>
            Fitness<span style={{ color: '#16a34a' }}>Tracker</span>
          </span>
        </div>

        {/* Desktop links */}
        <div className="nav-links-desktop" style={styles.links}>
          {NAV_LINKS.map((l) => {
            const active = location.pathname === l.path;
            return (
              <button
                key={l.path}
                onClick={() => navigate(l.path)}
                style={{ ...styles.link, ...(active ? styles.linkActive : {}) }}
              >
                <span style={styles.linkIcon}>{l.icon}</span>
                {l.label}
                {active && <span style={styles.activeDot} />}
              </button>
            );
          })}
        </div>

        {/* Right side */}
        <div style={styles.right}>
          <span className="nav-user-mobile-hide" style={styles.userName}>Hi, {user?.name?.split(' ')[0]}</span>
          <div className="nav-user-mobile-hide" style={styles.divider} />
          <button className="nav-user-mobile-hide" style={styles.btnLogout} onClick={handleLogout}>
            Sign out
          </button>
          {/* Hamburger */}
          <button
            className="nav-hamburger"
            style={styles.hamburger}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span style={styles.bar} />
            <span style={styles.bar} />
            <span style={styles.bar} />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={styles.mobileMenu}>
          {NAV_LINKS.map((l) => (
            <button
              key={l.path}
              style={styles.mobileLink}
              onClick={() => { navigate(l.path); setMenuOpen(false); }}
            >
              {l.icon} {l.label}
            </button>
          ))}
          <div style={styles.mobileDivider} />
          <button
            style={{ ...styles.mobileLink, color: '#dc2626' }}
            onClick={handleLogout}
          >
            🚪 Sign out
          </button>
        </div>
      )}
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: 'fixed',
    top: 12,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'calc(100% - 2rem)',
    maxWidth: 1100,
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1.25rem',
    background: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '0.5px solid rgba(0, 0, 0, 0.1)',
    borderRadius: 14,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
    zIndex: 900,
    gap: '1rem',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    flexShrink: 0,
  },
  brandIcon: {
    width: 32,
    height: 32,
    background: '#16a34a',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
  },
  brandText: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.25rem',
    color: '#111',
    letterSpacing: '0.04em',
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.1rem',
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    background: 'transparent',
    border: 'none',
    color: '#555',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.875rem',
    padding: '0.45rem 0.85rem',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s',
    position: 'relative',
  },
  linkActive: {
    color: '#16a34a',
    background: 'rgba(22, 163, 74, 0.08)',
  },
  linkIcon: { fontSize: '0.95rem' },
  activeDot: {
    position: 'absolute',
    bottom: 5,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: '#16a34a',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    flexShrink: 0,
  },
  userName: {
    color: '#888',
    fontSize: '0.82rem',
    fontWeight: 500,
  },
  divider: {
    width: 1,
    height: 20,
    background: 'rgba(0,0,0,0.1)',
  },
  btnLogout: {
    background: 'transparent',
    border: '0.5px solid rgba(0,0,0,0.18)',
    color: '#555',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    fontWeight: 600,
    padding: '0.4rem 0.9rem',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  hamburger: {
    display: 'none',
    flexDirection: 'column',
    gap: 5,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.4rem',
  },
  bar: {
    display: 'block',
    width: 20,
    height: 1.5,
    background: '#555',
    borderRadius: 2,
  },
  mobileMenu: {
    position: 'fixed',
    top: 76,
    left: '1rem',
    right: '1rem',
    background: 'rgba(255,255,255,0.96)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '0.5px solid rgba(0,0,0,0.1)',
    borderRadius: 12,
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    padding: '0.5rem',
    gap: '0.15rem',
    zIndex: 899,
  },
  mobileLink: {
    background: 'none',
    border: 'none',
    color: '#333',
    fontFamily: 'var(--font-body)',
    fontSize: '0.95rem',
    fontWeight: 600,
    textAlign: 'left',
    padding: '0.7rem 1rem',
    borderRadius: 8,
    cursor: 'pointer',
  },
  mobileDivider: {
    height: 1,
    background: 'rgba(0,0,0,0.06)',
    margin: '0.25rem 0.5rem',
  },
};

export default Navbar;