// ============================================================
// src/pages/LandingPage.tsx  –  Public landing / marketing page
// ============================================================
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ── Stat counter hook ────────────────────────────────────────
function useCounter(target: number, duration = 1800, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(ease * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return value;
}

// ── Intersection observer for scroll animations ──────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ── Feature card data ────────────────────────────────────────
const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={28} height={28}>
        <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/>
        <path d="M12 6v6l4 2"/>
      </svg>
    ),
    title: 'Smart Dashboard',
    desc: 'Real-time calories, protein, and workout stats in one glanceable view. Track your daily progress against personal targets.',
    color: 'var(--green)',
    colorDim: 'var(--green-dim)',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={28} height={28}>
        <path d="M3 3h18v18H3z" rx="2"/>
        <path d="M16 8a4 4 0 0 1-8 0"/>
        <path d="M12 12v5"/>
        <path d="M9 17h6"/>
      </svg>
    ),
    title: 'Food Tracker',
    desc: 'Log meals with macro breakdowns. Search thousands of foods and build custom meals. Hit your nutrition goals every day.',
    color: 'var(--orange)',
    colorDim: 'var(--orange-dim)',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={28} height={28}>
        <path d="M6.5 6.5h11M6.5 17.5h11M4 12h16"/>
        <circle cx="4" cy="6.5" r="1.5"/>
        <circle cx="20" cy="6.5" r="1.5"/>
        <circle cx="4" cy="17.5" r="1.5"/>
        <circle cx="20" cy="17.5" r="1.5"/>
      </svg>
    ),
    title: 'Gym Tracker',
    desc: 'Log sets, reps, and muscle groups for every workout. Weekly workout charts show your training volume over time.',
    color: '#7c3aed',
    colorDim: 'rgba(124,58,237,0.1)',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={28} height={28}>
        <path d="M3 3v18h18"/>
        <path d="M7 16l4-4 4 4 5-5"/>
      </svg>
    ),
    title: 'Weekly Reports',
    desc: 'Automated weekly summaries with nutrition averages, workout consistency, and weight change — so you always know where you stand.',
    color: 'var(--blue)',
    colorDim: 'var(--blue-dim)',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={28} height={28}>
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
    title: 'Goal-Driven Profile',
    desc: 'Set your goal — weight loss, gain, or maintenance. Get personalised calorie and protein targets calculated for your body.',
    color: '#0891b2',
    colorDim: 'rgba(8,145,178,0.1)',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={28} height={28}>
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>
      </svg>
    ),
    title: 'Weight Logging',
    desc: 'Log your weight daily and track progress toward your target. Visual trends keep you accountable over weeks and months.',
    color: '#16a34a',
    colorDim: 'rgba(22,163,74,0.1)',
  },
];

const GOALS = [
  { label: 'Weight Loss', icon: '🔥', desc: 'Calorie deficit with protein targets to preserve muscle' },
  { label: 'Weight Gain', icon: '💪', desc: 'Calorie surplus tuned to your body weight and activity' },
  { label: 'Maintain', icon: '⚖️', desc: 'Stay in balance with maintenance calories and healthy macros' },
];

const STEPS = [
  { num: '01', title: 'Create your account', desc: 'Sign up in under a minute. Set your height, weight, and fitness goal.' },
  { num: '02', title: 'Get your targets', desc: 'We calculate your personalised daily calorie and protein targets automatically.' },
  { num: '03', title: 'Log & track daily', desc: 'Record food, workouts, and weight. Watch your progress charts update in real time.' },
  { num: '04', title: 'Review & improve', desc: 'Read your weekly report every Sunday. Adjust, stay consistent, hit your goal.' },
];

// ── Component ────────────────────────────────────────────────
const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const heroRef = useRef<HTMLDivElement>(null);
  const { ref: statsRef, inView: statsInView } = useInView();
  const { ref: featuresRef, inView: featuresInView } = useInView();
  const { ref: stepsRef, inView: stepsInView } = useInView();

  const usersCount   = useCounter(12500, 2000, statsInView);
  const mealsCount   = useCounter(480000, 2200, statsInView);
  const workoutsCount = useCounter(95000, 2400, statsInView);
  const goalsCount   = useCounter(8700, 1900, statsInView);

  // Parallax hero bg on scroll (desktop only)
  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current && window.innerWidth > 980) {
        heroRef.current.style.backgroundPositionY = `${window.scrollY * 0.35}px`;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => { if (window.innerWidth > 768) setMenuOpen(false); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleHomeClick = () => {
    navigate(user ? '/home' : '/login');
  };

  return (
    <div style={s.root}>

      {/* ── Topbar ─────────────────────────────────────────── */}
      <header style={s.topbar}>
        <div style={s.topbarInner}>
          <div style={s.brand} onClick={() => navigate('/')}>
            <div style={s.brandIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" width={18} height={18}>
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <span style={s.brandText}>Fitness<span style={{ color: '#16a34a' }}>Tracker</span></span>
          </div>

          <nav className="lp-nav-desktop" style={s.topNav as React.CSSProperties}>
            <button style={s.navLinkBtn} onClick={() => {
              const el = document.getElementById('features');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}>Features</button>
            <button style={s.navLinkBtn} onClick={() => {
              const el = document.getElementById('how-it-works');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}>How it works</button>
            <button style={s.navLinkBtn} onClick={() => {
              const el = document.getElementById('goals');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}>Goals</button>
            <button style={{ ...s.navLinkBtn, color: '#16a34a', fontWeight: 700 }} onClick={handleHomeClick}>
              {user ? '🏠 Home' : '🔑 Log In'}
            </button>
          </nav>

          <div className="lp-actions-desktop" style={s.topActions as React.CSSProperties}>
            <button style={s.btnGhost} onClick={() => navigate('/login')}>
              Log in
            </button>
            <button style={s.btnGreen} onClick={() => navigate('/signup')}>Start for free</button>
          </div>

          {/* Hamburger */}
          <button
            className="lp-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
            style={s.hamburger as React.CSSProperties}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2} strokeLinecap="round" width={20} height={20}>
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18"/> : <path d="M3 6h18M3 12h18M3 18h18"/>}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        <div className={`lp-mobile-menu${menuOpen ? ' open' : ''}`} style={s.mobileMenu as React.CSSProperties}>
          <button style={s.mobileLinkBtn} onClick={() => {
            document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
            setMenuOpen(false);
          }}>✨ Features</button>
          <button style={s.mobileLinkBtn} onClick={() => {
            document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
            setMenuOpen(false);
          }}>📋 How it works</button>
          <button style={s.mobileLinkBtn} onClick={() => {
            document.getElementById('goals')?.scrollIntoView({ behavior: 'smooth' });
            setMenuOpen(false);
          }}>🎯 Goals</button>
          <div style={s.mobileDivider} />
          <button style={s.mobileLinkBtn} onClick={() => { handleHomeClick(); setMenuOpen(false); }}>
            {user ? '🏠 Home' : '🔑 Log In'}
          </button>
          <button style={s.mobileLinkBtn} onClick={() => { navigate('/login'); setMenuOpen(false); }}>
            Log in
          </button>
          <button style={{ ...s.mobileLinkBtn, color: '#16a34a', fontWeight: 700 }} onClick={() => { navigate('/signup'); setMenuOpen(false); }}>
            🚀 Start for free
          </button>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section ref={heroRef} style={s.hero} className="lp-hero">
        <div style={s.heroContent} className="lp-hero-content">
          <div style={s.heroBadge}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2} width={14} height={14}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            Your fitness, fully tracked
          </div>
          <h1 style={s.heroH1} className="lp-hero-h1">
            Train Smart.<br />
            <span style={s.heroGreen}>Eat Right.</span><br />
            Hit Your Goal.
          </h1>
          <p style={s.heroSub} className="lp-hero-sub">
            Log food, track workouts, monitor weight, and read weekly progress reports —
            all in one clean, fast dashboard built for people who take their fitness seriously.
          </p>
          <div style={s.heroCTA} className="lp-hero-cta">
            <button style={s.btnHeroPrimary} onClick={() => navigate('/signup')}>
              Get started free
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            <button style={s.btnHeroSecondary} onClick={() => navigate('/login')}>
              I have an account
            </button>
          </div>
          <p className="lp-hero-note" style={s.heroNote}>No credit card required · Free forever</p>
        </div>

        {/* Floating preview card */}
        <div style={s.heroCard} className="lp-hero-card">
          <div style={s.heroCardHeader}>
            <span style={s.heroCardTitle}>Today's Summary</span>
            <span style={s.heroBadgePill}>🔥 Weight Loss</span>
          </div>
          <div className="lp-hero-card-grid">
            {[
              { label: 'Calories', value: '1,840', sub: '/ 2,100 kcal', color: '#ea6c00' },
              { label: 'Protein',  value: '142g',  sub: '/ 160g target', color: '#1d4ed8' },
              { label: 'Weight',   value: '78.4',  sub: 'kg · –1.2 this week', color: '#16a34a' },
              { label: 'Sets',     value: '24',    sub: 'chest & triceps', color: '#7c3aed' },
            ].map(stat => (
              <div key={stat.label} style={s.heroStatCard}>
                <span style={s.heroStatLabel}>{stat.label}</span>
                <span style={{ ...s.heroStatVal, color: stat.color }}>{stat.value}</span>
                <span style={s.heroStatSub}>{stat.sub}</span>
                <div style={s.heroProgressTrack}>
                  <div style={{ ...s.heroProgressFill, width: stat.label === 'Sets' ? '75%' : '88%', background: stat.color }} />
                </div>
              </div>
            ))}
          </div>
          <div style={s.heroCardFooter}>
            <span style={s.heroFooterLabel}>Calories Remaining</span>
            <span style={{ ...s.heroFooterVal, color: '#16a34a' }}>260 kcal</span>
          </div>
        </div>
      </section>

      {/* ── Stats bar ──────────────────────────────────────── */}
      <section ref={statsRef} style={s.statsBar} className="lp-stats-bar">
        <div style={s.statsInner} className="lp-stats-inner">
          {[
            { val: usersCount.toLocaleString() + '+', label: 'Active users' },
            { val: mealsCount.toLocaleString() + '+', label: 'Meals logged' },
            { val: workoutsCount.toLocaleString() + '+', label: 'Workouts tracked' },
            { val: goalsCount.toLocaleString() + '+', label: 'Goals achieved' },
          ].map(stat => (
            <div key={stat.label} style={s.statItem}>
              <span style={s.statVal} className="lp-stat-val">{stat.val}</span>
              <span style={s.statLabel} className="lp-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section id="features" ref={featuresRef} className="lp-section" style={s.section}>
        <div style={s.sectionInner}>
          <div className="lp-section-head" style={s.sectionHead}>
            <p style={s.sectionEyebrow}>Everything you need</p>
            <h2 style={s.sectionH2} className="lp-section-h2">Built for serious fitness</h2>
            <p style={s.sectionDesc} className="lp-section-desc">
              Six core modules work together so you never have to switch apps, spreadsheets, or notebooks.
            </p>
          </div>
          <div style={s.featuresGrid} className="lp-features-grid">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                style={{
                  ...s.featureCard,
                  opacity: featuresInView ? 1 : 0,
                  transform: featuresInView ? 'translateY(0)' : 'translateY(28px)',
                  transition: `opacity 0.5s ${i * 0.08}s ease, transform 0.5s ${i * 0.08}s ease`,
                }}
              >
                <div style={{ ...s.featureIcon, color: f.color, background: f.colorDim }}>
                  {f.icon}
                </div>
                <h3 style={s.featureTitle}>{f.title}</h3>
                <p style={s.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section id="how-it-works" ref={stepsRef} className="lp-section" style={{ ...s.section, background: 'rgba(248,250,252,0.6)' }}>
        <div style={s.sectionInner}>
          <div className="lp-section-head" style={s.sectionHead}>
            <p style={s.sectionEyebrow}>Simple process</p>
            <h2 style={s.sectionH2} className="lp-section-h2">Up and running in minutes</h2>
            <p style={s.sectionDesc} className="lp-section-desc">Four steps from sign-up to seeing real progress.</p>
          </div>
          <div style={s.stepsGrid} className="lp-steps-grid">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                style={{
                  ...s.stepCard,
                  opacity: stepsInView ? 1 : 0,
                  transform: stepsInView ? 'translateY(0)' : 'translateY(24px)',
                  transition: `opacity 0.5s ${i * 0.1}s ease, transform 0.5s ${i * 0.1}s ease`,
                }}
              >
                <span style={s.stepNum}>{step.num}</span>
                <h3 style={s.stepTitle}>{step.title}</h3>
                <p style={s.stepDesc}>{step.desc}</p>
                {i < STEPS.length - 1 && <div style={s.stepConnector} />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Goals section ──────────────────────────────────── */}
      <section id="goals" className="lp-section" style={s.section}>
        <div style={s.sectionInner}>
          <div className="lp-section-head" style={s.sectionHead}>
            <p style={s.sectionEyebrow}>Any goal, one app</p>
            <h2 style={s.sectionH2} className="lp-section-h2">You set the goal. We crunch the numbers.</h2>
            <p style={s.sectionDesc} className="lp-section-desc">
              Whether you're cutting, bulking, or maintaining, FitnessTracker calculates
              your exact calorie and protein targets and tracks you against them daily.
            </p>
          </div>
          <div style={s.goalsGrid} className="lp-goals-grid">
            {GOALS.map(g => (
              <div key={g.label} style={s.goalCard}>
                <div style={s.goalEmoji}>{g.icon}</div>
                <h3 style={s.goalTitle}>{g.label}</h3>
                <p style={s.goalDesc}>{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ─────────────────────────────────────── */}
      <section className="lp-cta" style={s.ctaBanner}>
        <div style={s.ctaOverlay} />
        <div style={s.ctaContent}>
          <h2 style={s.ctaH2} className="lp-cta-h2">Ready to take control?</h2>
          <p style={s.ctaSub} className="lp-cta-sub">
            Join thousands of people who track their fitness with FitnessTracker every day.
          </p>
          <button style={s.btnCTA} onClick={() => navigate('/signup')}>
            Create your free account
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          <p style={{ ...s.heroNote, color: 'rgba(255,255,255,0.55)', marginTop: '1rem' }}>
            Already have an account?{' '}
            <span
              style={{ color: '#4ade80', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
              onClick={() => navigate('/login')}
            >
              Log in
            </span>
          </p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer style={s.footer} className="lp-footer">
        <div style={s.footerInner} className="lp-footer-inner">
          <div style={s.brand}>
            <div style={s.brandIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" width={18} height={18}>
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <span style={{ ...s.brandText, color: '#f1f5f9' }}>
              Fitness<span style={{ color: '#4ade80' }}>Tracker</span>
            </span>
          </div>
          <p style={s.footerNote}>© {new Date().getFullYear()} FitnessTracker. Built to help you get results.</p>
        </div>
      </footer>
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  root: {
    fontFamily: 'var(--font-body)',
    color: 'var(--text-primary)',
    overflowX: 'hidden',
  },

  // Topbar
  topbar: {
    position: 'fixed',
    top: 12,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'calc(100% - 2rem)',
    maxWidth: 1100,
    zIndex: 900,
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '0.5px solid rgba(0,0,0,0.1)',
    borderRadius: 14,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  topbarInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1.25rem',
    height: 56,
    gap: '1rem',
  },
  brand: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, cursor: 'pointer' },
  brandIcon: {
    width: 32, height: 32,
    background: '#16a34a',
    borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  brandText: {
    fontFamily: '"Bebas Neue", sans-serif',
    fontSize: '1.3rem',
    letterSpacing: '0.04em',
    color: '#111',
  },
  topNav: { display: 'flex', gap: '0.25rem', alignItems: 'center' },
  navLinkBtn: {
    color: '#555',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: 500,
    padding: '0.45rem 0.85rem',
    borderRadius: 8,
    transition: 'color 0.15s, background 0.15s',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    whiteSpace: 'nowrap',
  },
  topActions: { display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 },
  btnGhost: {
    background: 'transparent',
    border: '0.5px solid rgba(0,0,0,0.18)',
    color: '#555',
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    fontWeight: 600,
    padding: '0.45rem 1rem',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  btnGreen: {
    background: 'linear-gradient(135deg, #16a34a, #14532d)',
    color: '#fff',
    border: 'none',
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    fontWeight: 700,
    padding: '0.5rem 1.1rem',
    borderRadius: 8,
    cursor: 'pointer',
    boxShadow: '0 0 16px rgba(22,163,74,0.25)',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
  },
  hamburger: {
    display: 'none',
    flexDirection: 'column',
    gap: 5,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.4rem',
    color: '#555',
  },
  mobileMenu: {
    display: 'none',
    flexDirection: 'column',
    padding: '0.5rem',
    gap: '0.15rem',
    background: 'rgba(255,255,255,0.96)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '0.5px solid rgba(0,0,0,0.1)',
    borderRadius: 12,
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    margin: '0.5rem 0.75rem',
  },
  mobileLinkBtn: {
    background: 'none',
    border: 'none',
    color: '#333',
    fontFamily: 'var(--font-body)',
    fontSize: '0.95rem',
    fontWeight: 500,
    textAlign: 'left',
    padding: '0.7rem 1rem',
    borderRadius: 8,
    cursor: 'pointer',
    width: '100%',
  },
  mobileDivider: {
    height: 1,
    background: 'rgba(0,0,0,0.06)',
    margin: '0.25rem 0.5rem',
  },

  // Hero
  hero: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '3rem',
    padding: '7rem 2rem 4rem',
    maxWidth: 1200,
    margin: '0 auto',
    position: 'relative',
  },
  heroOverlay: { display: 'none' },
  heroContent: { flex: '0 0 auto', maxWidth: 540 },
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: 'rgba(22,163,74,0.08)',
    border: '1px solid rgba(22,163,74,0.25)',
    color: '#15803d',
    fontSize: '0.78rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    padding: '0.35rem 0.85rem',
    borderRadius: 99,
    marginBottom: '1.25rem',
  },
  heroH1: {
    fontFamily: '"Bebas Neue", sans-serif',
    fontSize: 'clamp(3rem, 7vw, 5.5rem)',
    lineHeight: 1.05,
    letterSpacing: '0.03em',
    color: '#0f172a',
    marginBottom: '1.25rem',
  },
  heroGreen: { color: '#16a34a' },
  heroSub: {
    fontSize: '1.05rem',
    color: '#475569',
    lineHeight: 1.7,
    marginBottom: '2rem',
    maxWidth: 480,
  },
  heroCTA: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' },
  btnHeroPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'linear-gradient(135deg, #16a34a, #14532d)',
    color: '#fff',
    border: 'none',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '1rem',
    padding: '0.85rem 1.75rem',
    borderRadius: 10,
    cursor: 'pointer',
    boxShadow: '0 0 24px rgba(22,163,74,0.3)',
    transition: 'all 0.2s',
  },
  btnHeroSecondary: {
    background: '#fff',
    color: '#374151',
    border: '1px solid rgba(0,0,0,0.12)',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '1rem',
    padding: '0.85rem 1.5rem',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  heroNote: {
    marginTop: '1rem',
    fontSize: '0.8rem',
    color: '#94a3b8',
  },

  // Hero card
  heroCard: {
    flex: '0 0 auto',
    width: 340,
    background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: 20,
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    padding: '1.5rem',
    animation: 'fadeIn 0.7s 0.3s ease both',
  },
  heroCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  heroCardTitle: {
    fontFamily: '"Bebas Neue", sans-serif',
    fontSize: '1.2rem',
    letterSpacing: '0.05em',
    color: '#0f172a',
  },
  heroBadgePill: {
    background: 'rgba(234,108,0,0.1)',
    color: '#ea6c00',
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '0.25rem 0.65rem',
    borderRadius: 99,
    whiteSpace: 'nowrap',
  },
  heroStatCard: {
    background: 'rgba(248,250,252,0.8)',
    border: '1px solid rgba(0,0,0,0.06)',
    borderRadius: 12,
    padding: '0.9rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  heroStatLabel: {
    fontSize: '0.68rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#94a3b8',
  },
  heroStatVal: {
    fontFamily: '"Bebas Neue", sans-serif',
    fontSize: '1.5rem',
    lineHeight: 1,
  },
  heroStatSub: { fontSize: '0.7rem', color: '#94a3b8' },
  heroProgressTrack: {
    marginTop: '0.5rem',
    height: 5,
    background: 'rgba(0,0,0,0.07)',
    borderRadius: 99,
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: 99,
    transition: 'width 1s ease',
  },
  heroCardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(22,163,74,0.06)',
    border: '1px solid rgba(22,163,74,0.15)',
    borderRadius: 10,
    padding: '0.65rem 0.85rem',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  heroFooterLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  heroFooterVal: {
    fontFamily: '"Bebas Neue", sans-serif',
    fontSize: '1.4rem',
    letterSpacing: '0.04em',
  },

  // Stats bar
  statsBar: {
    background: 'rgba(255,255,255,0.7)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderTop: '1px solid rgba(0,0,0,0.07)',
    borderBottom: '1px solid rgba(0,0,0,0.07)',
    padding: '2rem 2rem',
  },
  statsInner: {
    maxWidth: 1100,
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: '1.5rem',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.2rem',
  },
  statVal: {
    fontFamily: '"Bebas Neue", sans-serif',
    fontSize: '2.4rem',
    letterSpacing: '0.04em',
    color: '#16a34a',
  },
  statLabel: {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },

  // Sections
  section: { padding: '5rem 2rem' },
  sectionInner: { maxWidth: 1100, margin: '0 auto' },
  sectionHead: { textAlign: 'center', marginBottom: '3.5rem' },
  sectionEyebrow: {
    fontSize: '0.78rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#16a34a',
    marginBottom: '0.5rem',
  },
  sectionH2: {
    fontFamily: '"Bebas Neue", sans-serif',
    fontSize: 'clamp(2rem, 4vw, 3rem)',
    letterSpacing: '0.04em',
    color: '#0f172a',
    marginBottom: '0.75rem',
    lineHeight: 1.1,
  },
  sectionDesc: {
    color: '#475569',
    fontSize: '1rem',
    lineHeight: 1.7,
    maxWidth: 520,
    margin: '0 auto',
  },

  // Features
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '1.25rem',
  },
  featureCard: {
    background: 'rgba(255,255,255,0.8)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(0,0,0,0.07)',
    borderRadius: 16,
    padding: '1.75rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
    cursor: 'default',
  },
  featureIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  featureTitle: {
    fontFamily: '"Bebas Neue", sans-serif',
    fontSize: '1.25rem',
    letterSpacing: '0.04em',
    color: '#0f172a',
    marginBottom: '0.5rem',
  },
  featureDesc: {
    fontSize: '0.9rem',
    color: '#64748b',
    lineHeight: 1.65,
  },

  // Steps
  stepsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '1.5rem',
    position: 'relative',
  },
  stepCard: {
    background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(0,0,0,0.07)',
    borderRadius: 16,
    padding: '1.75rem 1.5rem',
    position: 'relative',
  },
  stepNum: {
    fontFamily: '"Bebas Neue", sans-serif',
    fontSize: '2.2rem',
    color: 'rgba(22,163,74,0.2)',
    letterSpacing: '0.05em',
    display: 'block',
    marginBottom: '0.75rem',
  },
  stepTitle: {
    fontWeight: 800,
    fontSize: '1rem',
    color: '#0f172a',
    marginBottom: '0.5rem',
  },
  stepDesc: {
    fontSize: '0.88rem',
    color: '#64748b',
    lineHeight: 1.65,
  },
  stepConnector: { display: 'none' },

  // Goals
  goalsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '1.25rem',
    maxWidth: 900,
    margin: '0 auto',
  },
  goalCard: {
    background: 'rgba(255,255,255,0.8)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(0,0,0,0.07)',
    borderRadius: 16,
    padding: '2rem',
    textAlign: 'center',
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  goalEmoji: { fontSize: '2.5rem', marginBottom: '0.75rem' },
  goalTitle: {
    fontFamily: '"Bebas Neue", sans-serif',
    fontSize: '1.4rem',
    letterSpacing: '0.04em',
    color: '#0f172a',
    marginBottom: '0.5rem',
  },
  goalDesc: { fontSize: '0.9rem', color: '#64748b', lineHeight: 1.65 },

  // CTA banner
  ctaBanner: {
    position: 'relative',
    overflow: 'hidden',
    background: 'linear-gradient(135deg, #14532d 0%, #16a34a 50%, #065f46 100%)',
    padding: '5rem 2rem',
    textAlign: 'center',
  },
  ctaOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.07) 0%, transparent 60%), radial-gradient(circle at 80% 30%, rgba(255,255,255,0.05) 0%, transparent 60%)',
    pointerEvents: 'none',
  },
  ctaContent: { position: 'relative', maxWidth: 600, margin: '0 auto' },
  ctaH2: {
    fontFamily: '"Bebas Neue", sans-serif',
    fontSize: 'clamp(2.5rem, 5vw, 4rem)',
    letterSpacing: '0.04em',
    color: '#fff',
    marginBottom: '1rem',
  },
  ctaSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: '1.05rem',
    lineHeight: 1.7,
    marginBottom: '2rem',
  },
  btnCTA: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.6rem',
    background: '#fff',
    color: '#15803d',
    border: 'none',
    fontFamily: 'var(--font-body)',
    fontWeight: 800,
    fontSize: '1rem',
    padding: '1rem 2rem',
    borderRadius: 12,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    transition: 'all 0.2s',
  },

  // Footer
  footer: {
    background: '#0f172a',
    padding: '2rem',
  },
  footerInner: {
    maxWidth: 1100,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  footerNote: {
    color: '#475569',
    fontSize: '0.82rem',
  },
};

export default LandingPage;
