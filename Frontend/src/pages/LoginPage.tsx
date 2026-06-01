// ============================================================
// src/pages/LoginPage.tsx
// ============================================================
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/home');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.bg}>
      {/* Background image */}
      <div style={styles.bgOverlay} />

      <div style={styles.container} className="fade-in">
        {/* Logo */}
        <div style={styles.logoWrap}>
          <img src="/image/logo.png" alt="Fitness Tracker" style={styles.logo}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <h1 style={styles.appName}>Fitness<span style={{ color: 'var(--green)' }}>Tracker</span></h1>
        </div>

        <div className="glass" style={styles.card}>
          <h2 style={styles.title}>Welcome Back</h2>
          <p style={styles.subtitle}>Sign in to your fitness journey</p>

          {error && <div className="msg-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label">Email</label>
              <input
                className="input-field"
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="form-label">Password</label>
              <input
                className="input-field"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: '0.5rem', padding: '0.85rem' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p style={styles.switchLink}>
            Don't have an account?{' '}
            <span style={styles.link} onClick={() => navigate('/signup')}>Create one</span>
          </p>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  bg: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundImage: 'url(/image/background.png)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  },
  bgOverlay: {
    position: 'absolute', inset: 0,
    background: 'rgba(10,14,26,0.75)',
    backdropFilter: 'blur(2px)',
  },
  container: {
    position: 'relative', zIndex: 1,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem',
    width: '100%', maxWidth: 420, padding: '1rem',
  },
  logoWrap: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
  },
  logo: { width: 56, height: 56, objectFit: 'contain' },
  appName: {
    fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.05em', color: 'var(--text-primary)',
  },
  card: {
    width: '100%', padding: '2rem',
  },
  title: {
    fontFamily: 'var(--font-display)', fontSize: '1.8rem', letterSpacing: '0.04em',
    color: 'var(--text-primary)', marginBottom: '0.25rem',
  },
  subtitle: {
    color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem',
  },
  switchLink: {
    marginTop: '1.25rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem',
  },
  link: { color: 'var(--green)', cursor: 'pointer', fontWeight: 700 },
};

export default LoginPage;
