// ============================================================
// src/pages/SignupPage.tsx  –  4-step signup with OTP
// ============================================================
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

// ── Config ───────────────────────────────────────────────────
// OTP server runs on port 5001 (separate from the main API on 5000)
const OTP_SERVER = process.env.REACT_APP_OTP_URL;

interface FormData {
  name: string; email: string; password: string;
  age: string; gender: string; height: string; weight: string;
  goal: string; gym_status: boolean; activity_level: string; target_weight: string;
}

const GOALS = [
  { value: 'weight_loss', label: 'Weight Loss', icon: '🔥' },
  { value: 'weight_gain', label: 'Weight Gain', icon: '💪' },
  { value: 'maintain',    label: 'Maintain',    icon: '⚖️' },
];

const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep]       = useState(1);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  // OTP state
  const [otp, setOtp]               = useState(['', '', '', '', '', '']);
  const [otpSending, setOtpSending] = useState(false);
  const [otpTimer, setOtpTimer]     = useState(0);
  const [otpSuccess, setOtpSuccess] = useState(false);
  const inputRefs                   = useRef<(HTMLInputElement | null)[]>([]);

  const [form, setForm] = useState<FormData>({
    name: '', email: '', password: '',
    age: '', gender: 'male', height: '', weight: '',
    goal: 'weight_loss', gym_status: true, activity_level: '5', target_weight: '',
  });

  const set = (key: keyof FormData, val: string | boolean) =>
    setForm((p) => ({ ...p, [key]: val }));

  // ── OTP Timer countdown ──────────────────────────────────
  useEffect(() => {
    if (otpTimer <= 0) return;
    const t = setTimeout(() => setOtpTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [otpTimer]);

  // ── Send OTP ──────────────────────────────────────────────
  const sendOTP = async () => {
    setError('');
    setOtpSending(true);
    try {
      const res = await fetch(`${OTP_SERVER}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to send OTP');
      setOtpTimer(60);
      setOtp(['', '', '', '', '', '']);
      // Focus first box
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setError(err.message || 'Could not send OTP. Check email and try again.');
    } finally {
      setOtpSending(false);
    }
  };

  // Called when step 3 → step 4
  const goToOTP = async () => {
    setError('');
    setOtpSending(true);
    setStep(4);
    // small delay so UI renders first
    await new Promise(r => setTimeout(r, 150));
    await sendOTP();
  };

  // ── OTP input handlers ────────────────────────────────────
  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
    e.preventDefault();
  };

  // ── Verify OTP + signup ───────────────────────────────────
  const handleVerifyAndSignup = async () => {
    const otpCode = otp.join('');
    if (otpCode.length < 6) return setError('Enter all 6 digits');
    setError('');
    setLoading(true);
    try {
      // 1. Verify OTP against OTP server
      const verifyRes = await fetch(`${OTP_SERVER}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password, otp: otpCode }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success) throw new Error(verifyData.message || 'Invalid OTP');

      setOtpSuccess(true);

      // 2. OTP verified → create account on the main backend
      await authAPI.signup({
        ...form,
        age: Number(form.age),
        height: Number(form.height),
        weight: Number(form.weight),
        target_weight: Number(form.target_weight),
        activity_level: Number(form.activity_level),
      });

      // 3. Auto-login
      await login(form.email, form.password);
      navigate('/home');
    } catch (err: any) {
      setOtpSuccess(false);
      setError(err?.response?.data?.message || err.message || 'Verification failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { label: 'Account', icon: '🔐' },
    { label: 'Body',    icon: '📏' },
    { label: 'Goal',    icon: '🎯' },
    { label: 'Verify',  icon: '✉️'  },
  ];

  return (
    <div style={styles.bg}>
      <div style={styles.bgOverlay} />
      <div style={styles.container} className="fade-in">
        {/* Logo */}
        <div style={styles.logoWrap}>
          <img
            src="https://res.cloudinary.com/dw9kvnkkz/image/upload/v1780311049/logo_zfqzvd.png"
            alt="Fitness Tracker"
            style={styles.logo}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <h1 style={styles.appName}>
            Fitness<span style={{ color: 'var(--green)' }}>Tracker</span>
          </h1>
        </div>

        <div className="glass" style={styles.card}>
          {/* Step indicator */}
          <div style={styles.stepRow}>
            {steps.map((s, i) => (
              <React.Fragment key={s.label}>
                <div style={{
                  ...styles.stepItem,
                  ...(step > i ? styles.stepDone : step === i + 1 ? styles.stepActive : {}),
                }}>
                  <div style={styles.stepCircle}>{step > i + 1 ? '✓' : s.icon}</div>
                  <span style={styles.stepLabel}>{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ ...styles.stepLine, ...(step > i + 1 ? styles.stepLineDone : {}) }} />
                )}
              </React.Fragment>
            ))}
          </div>

          {error && <div className="msg-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          {/* ── Step 1 ──────────────────────────────────────── */}
          {step === 1 && (
            <div style={styles.formGrid} className="fade-in">
              <h2 style={styles.stepTitle}>Create Account</h2>
              <div>
                <label className="form-label">Full Name</label>
                <input className="input-field" placeholder="John Doe" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input className="input-field" type="email" placeholder="you@email.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Password</label>
                <input className="input-field" type="password" placeholder="Min. 6 characters" value={form.password} onChange={e => set('password', e.target.value)} />
              </div>
              <button
                className="btn-primary"
                style={{ marginTop: '0.5rem' }}
                onClick={() => {
                  if (!form.name || !form.email || !form.password) return setError('Fill all fields');
                  if (form.password.length < 6) return setError('Password must be at least 6 characters');
                  setError('');
                  setStep(2);
                }}
              >
                Continue →
              </button>
            </div>
          )}

          {/* ── Step 2 ──────────────────────────────────────── */}
          {step === 2 && (
            <div style={styles.formGrid} className="fade-in">
              <h2 style={styles.stepTitle}>Body Stats</h2>
              <div className="grid-2">
                <div>
                  <label className="form-label">Age</label>
                  <input className="input-field" type="number" placeholder="25" value={form.age} onChange={e => set('age', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Gender</label>
                  <select className="input-field" value={form.gender} onChange={e => set('gender', e.target.value)}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Height (cm)</label>
                  <input className="input-field" type="number" placeholder="172" value={form.height} onChange={e => set('height', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Weight (kg)</label>
                  <input className="input-field" type="number" placeholder="72" value={form.weight} onChange={e => set('weight', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="form-label">Target Weight (kg)</label>
                <input className="input-field" type="number" placeholder="65" value={form.target_weight} onChange={e => set('target_weight', e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</button>
                <button className="btn-primary" style={{ flex: 2 }}
                  onClick={() => {
                    if (!form.age || !form.height || !form.weight) return setError('Fill all body stats');
                    setError('');
                    setStep(3);
                  }}>
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3 ──────────────────────────────────────── */}
          {step === 3 && (
            <div style={styles.formGrid} className="fade-in">
              <h2 style={styles.stepTitle}>Your Goal</h2>

              <div>
                <label className="form-label">Fitness Goal</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  {GOALS.map((g) => (
                    <button
                      key={g.value}
                      style={{ ...styles.goalBtn, ...(form.goal === g.value ? styles.goalBtnActive : {}) }}
                      onClick={() => set('goal', g.value)}
                    >
                      <span style={{ fontSize: '1.4rem' }}>{g.icon}</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label">Activity Level (1–10)</label>
                <input
                  className="input-field" type="range" min="1" max="10"
                  value={form.activity_level} onChange={e => set('activity_level', e.target.value)}
                  style={{ padding: '0.25rem 0' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  <span>Sedentary</span>
                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>Level {form.activity_level}</span>
                  <span>Very Active</span>
                </div>
              </div>

              <div>
                <label className="form-label">Do you go to the gym?</label>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                  {[{ label: '🏋️ Going to gym', val: true }, { label: '🏠 Not going', val: false }].map((o) => (
                    <button
                      key={String(o.val)}
                      style={{ ...styles.gymBtn, ...(form.gym_status === o.val ? styles.gymBtnActive : {}) }}
                      onClick={() => set('gym_status', o.val)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(2)}>← Back</button>
                <button
                  className="btn-primary" style={{ flex: 2 }}
                  onClick={goToOTP}
                  disabled={otpSending}
                >
                  {otpSending ? 'Sending OTP...' : '📧 Verify Email →'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4 – OTP Verification ────────────────────── */}
          {step === 4 && (
            <div style={styles.formGrid} className="fade-in">
              <div style={styles.otpHeader}>
                <div style={styles.otpIconWrap}>✉️</div>
                <h2 style={styles.stepTitle}>Verify Email</h2>
                <p style={styles.otpSubtitle}>
                  We sent a 6-digit code to<br />
                  <strong style={{ color: 'var(--green)' }}>{form.email}</strong>
                </p>
              </div>

              {/* 6-box OTP input */}
              <div style={styles.otpBoxRow} onPaste={handleOtpPaste}>
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => { inputRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(idx, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(idx, e)}
                    style={{
                      ...styles.otpBox,
                      ...(digit ? styles.otpBoxFilled : {}),
                      ...(otpSuccess ? styles.otpBoxSuccess : {}),
                    }}
                  />
                ))}
              </div>

              {otpSuccess && (
                <div style={styles.successBanner}>
                  ✅ Email verified! Creating your account…
                </div>
              )}

              <button
                className="btn-primary"
                onClick={handleVerifyAndSignup}
                disabled={loading || otp.join('').length < 6}
                style={{ marginTop: '0.25rem' }}
              >
                {loading ? 'Creating Account…' : '🚀 Confirm & Create Account'}
              </button>

              {/* Resend */}
              <div style={styles.resendRow}>
                {otpTimer > 0 ? (
                  <span style={styles.timerText}>Resend OTP in <strong style={{ color: 'var(--green)' }}>{otpTimer}s</strong></span>
                ) : (
                  <button
                    style={styles.resendBtn}
                    onClick={sendOTP}
                    disabled={otpSending}
                  >
                    {otpSending ? 'Sending…' : '↺ Resend OTP'}
                  </button>
                )}
              </div>

              <button
                className="btn-secondary"
                style={{ marginTop: '0rem' }}
                onClick={() => { setStep(3); setOtp(['', '', '', '', '', '']); setError(''); }}
              >
                ← Change Email / Go Back
              </button>
            </div>
          )}

          <p style={styles.switchLink}>
            Already have an account?{' '}
            <span style={styles.link} onClick={() => navigate('/login')}>Sign in</span>
          </p>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  bg: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', backgroundImage: 'url(/image/background.png)', backgroundSize: 'cover', backgroundPosition: 'center' },
  bgOverlay: { position: 'absolute', inset: 0, background: 'rgba(10,14,26,0.78)', backdropFilter: 'blur(2px)' },
  container: { position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', width: '100%', maxWidth: 480, padding: '1rem' },
  logoWrap: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  logo: { width: 48, height: 48, objectFit: 'contain' },
  appName: { fontFamily: 'var(--font-display)', fontSize: '1.8rem', letterSpacing: '0.05em', color: 'var(--text-primary)' },
  card: { width: '100%', padding: '2rem' },
  stepRow: { display: 'flex', alignItems: 'center', marginBottom: '1.75rem', gap: '0' },
  stepItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', flex: 1, opacity: 0.4, transition: 'opacity 0.2s' },
  stepActive: { opacity: 1 },
  stepDone: { opacity: 0.7 },
  stepCircle: { width: 36, height: 36, borderRadius: '50%', background: 'var(--green-dim)', border: '2px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' },
  stepLabel: { fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' },
  stepLine: { flex: 1, height: 2, background: 'var(--border)', margin: '0 0.5rem', marginBottom: '1.2rem' },
  stepLineDone: { background: 'var(--green)' },
  stepTitle: { fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text-primary)', marginBottom: '0.5rem', textAlign: 'center' },
  formGrid: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  goalBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', padding: '0.75rem 0.5rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.15s' },
  goalBtnActive: { border: '1px solid var(--green)', background: 'var(--green-dim)', color: 'var(--green)' },
  gymBtn: { flex: 1, padding: '0.65rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.15s' },
  gymBtnActive: { border: '1px solid var(--green)', background: 'var(--green-dim)', color: 'var(--green)' },
  switchLink: { marginTop: '1.25rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' },
  link: { color: 'var(--green)', cursor: 'pointer', fontWeight: 700 },

  // OTP-specific
  otpHeader: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' },
  otpIconWrap: { fontSize: '2.5rem', lineHeight: 1 },
  otpSubtitle: { textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 },
  otpBoxRow: { display: 'flex', gap: '0.5rem', justifyContent: 'center', margin: '0.5rem 0' },
  otpBox: {
    width: 48, height: 56, textAlign: 'center', fontSize: '1.4rem', fontWeight: 700,
    background: 'rgba(255,255,255,0.05)', border: '1.5px solid var(--border)',
    borderRadius: 10, color: 'var(--text-primary)', outline: 'none',
    caretColor: 'var(--green)', transition: 'border-color 0.15s, background 0.15s',
    fontFamily: 'var(--font-display)',
  } as React.CSSProperties,
  otpBoxFilled: { borderColor: 'var(--green)', background: 'var(--green-dim)' } as React.CSSProperties,
  otpBoxSuccess: { borderColor: '#22c55e', background: 'rgba(34,197,94,0.12)' } as React.CSSProperties,
  successBanner: { textAlign: 'center', color: '#22c55e', fontSize: '0.9rem', fontWeight: 600, padding: '0.5rem', background: 'rgba(34,197,94,0.1)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.25)' },
  resendRow: { textAlign: 'center' as const },
  timerText: { color: 'var(--text-muted)', fontSize: '0.85rem' },
  resendBtn: { background: 'none', border: 'none', color: 'var(--green)', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', padding: '0.25rem 0.5rem', borderRadius: 6, textDecoration: 'underline' },
};

export default SignupPage;