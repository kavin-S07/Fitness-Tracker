// ============================================================
// src/pages/HomePage.tsx  –  Dashboard
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../services/api';
import { Dashboard } from '../types';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid,
} from 'recharts';

const GoalLabel: Record<string, string> = {
  weight_loss: '🔥 Weight Loss',
  weight_gain: '💪 Weight Gain',
  maintain: '⚖️ Maintain',
};

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [weightInput, setWeightInput] = useState('');
  const [weightMsg, setWeightMsg] = useState('');
  const [report, setReport] = useState<any>(null);
  const [showReport, setShowReport] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await dashboardAPI.get();
      setData(res.data.dashboard);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const logWeight = async () => {
    if (!weightInput) return;
    try {
      await dashboardAPI.logWeight(Number(weightInput));
      setWeightMsg('✅ Weight logged!');
      setWeightInput('');
      load();
      setTimeout(() => setWeightMsg(''), 3000);
    } catch { setWeightMsg('Failed to log weight.'); }
  };

  const loadReport = async () => {
    try {
      const res = await dashboardAPI.weeklyReport();
      setReport(res.data.report);
      setShowReport(true);
    } catch { /* ignore */ }
  };

  if (loading) return <div className="page-wrap" style={{ display: 'flex', justifyContent: 'center', paddingTop: '5rem' }}><div className="spinner" /></div>;

  const today = data?.today;
  const u = data?.user;

  const calPct = u ? Math.min(100, Math.round(((today?.calories_consumed || 0) / u.daily_calories_target) * 100)) : 0;
  const proPct = u ? Math.min(100, Math.round(((today?.protein_consumed || 0) / u.daily_protein_target) * 100)) : 0;

  const chartData = data?.weekly_food_chart.map(d => ({
    date: d.date.slice(5),
    Calories: Math.round(Number(d.calories)),
    Protein: Math.round(Number(d.protein)),
  })) || [];

  const workoutChart = data?.weekly_workout_chart.map(d => ({
    date: d.workout_date.slice(5),
    Sets: Number(d.total_sets),
  })) || [];

  return (
    <div className="page-wrap">
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }} className="fade-in">
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', letterSpacing: '0.04em' }}>
          Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'},{' '}
          <span style={{ color: 'var(--green)' }}>{u?.name?.split(' ')[0] || user?.name?.split(' ')[0]}</span> 💪
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          &nbsp;·&nbsp;{u?.goal ? GoalLabel[u.goal] : ''}
        </p>
      </div>

      {/* Top stat cards */}
      <div className="grid-4 fade-in-delay-1" style={{ marginBottom: '1.5rem' }}>
        {/* Calories today */}
        <div className="stat-card">
          <div className="label">Calories Today</div>
          <div className="value" style={{ color: 'var(--orange)' }}>{today?.calories_consumed ?? 0}</div>
          <div className="sub">/ {u?.daily_calories_target} kcal target</div>
          <div className="progress-bar-track" style={{ marginTop: '0.6rem' }}>
            <div className="progress-bar-fill" style={{ width: `${calPct}%`, background: 'linear-gradient(90deg, var(--orange), #fb923c)' }} />
          </div>
        </div>

        {/* Protein today */}
        <div className="stat-card">
          <div className="label">Protein Today</div>
          <div className="value" style={{ color: 'var(--blue)' }}>{today?.protein_consumed ?? 0}g</div>
          <div className="sub">/ {u?.daily_protein_target}g target</div>
          <div className="progress-bar-track" style={{ marginTop: '0.6rem' }}>
            <div className="progress-bar-fill" style={{ width: `${proPct}%`, background: 'linear-gradient(90deg, var(--blue), #60a5fa)' }} />
          </div>
        </div>

        {/* Weight */}
        <div className="stat-card">
          <div className="label">Current Weight</div>
          <div className="value" style={{ color: 'var(--green)' }}>{u?.current_weight ?? user?.weight ?? '–'}<span style={{ fontSize: '1rem' }}> kg</span></div>
          <div className="sub">Target: {u?.target_weight ?? user?.target_weight ?? '–'} kg</div>
        </div>

        {/* Workout */}
        <div className="stat-card">
          <div className="label">Today's Workout</div>
          <div className="value" style={{ color: '#a78bfa' }}>{today?.workout_sets ?? 0}<span style={{ fontSize: '1rem' }}> sets</span></div>
          <div className="sub">{today?.muscle_groups_trained || 'No workout yet'}</div>
        </div>
      </div>

      {/* Remaining callout */}
      <div style={styles.remaining} className="fade-in-delay-2">
        <div style={styles.remainItem}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Calories Remaining</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: (today?.calories_remaining ?? 0) < 0 ? 'var(--red)' : 'var(--green)' }}>
            {today?.calories_remaining ?? 0} kcal
          </span>
        </div>
        <div style={{ width: 1, background: 'var(--border)', margin: '0 1rem' }} />
        <div style={styles.remainItem}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Protein Remaining</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: (today?.protein_remaining ?? 0) < 0 ? 'var(--red)' : 'var(--blue)' }}>
            {today?.protein_remaining ?? 0}g
          </span>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn-secondary" onClick={loadReport} style={{ fontSize: '0.82rem' }}>📊 Weekly Report</button>
        </div>
      </div>

      {/* Charts */}
      <div className="grid-2 fade-in-delay-3" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Calorie chart */}
        <div className="glass" style={{ padding: '1.25rem' }}>
          <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem' }}>📈 Weekly Calories</p>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 8, color: '#f1f5f9' }} />
                <Area type="monotone" dataKey="Calories" stroke="#f97316" strokeWidth={2} fill="url(#calGrad)" dot={{ fill: '#f97316', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '3rem' }}>No data yet</p>}
        </div>

        {/* Workout chart */}
        <div className="glass" style={{ padding: '1.25rem' }}>
          <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem' }}>🏋️ Weekly Workout Sets</p>
          {workoutChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={workoutChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 8, color: '#f1f5f9' }} />
                <Bar dataKey="Sets" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '3rem' }}>No workout data</p>}
        </div>
      </div>

      {/* Log weight */}
      <div className="glass" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <p style={{ fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>⚖️ Log Today's Weight</p>
        <input
          className="input-field"
          type="number"
          placeholder="e.g. 70.5 kg"
          value={weightInput}
          onChange={(e) => setWeightInput(e.target.value)}
          style={{ maxWidth: 160 }}
        />
        <button className="btn-primary" onClick={logWeight} style={{ padding: '0.65rem 1.25rem' }}>Log</button>
        {weightMsg && <span style={{ color: 'var(--green)', fontSize: '0.88rem' }}>{weightMsg}</span>}
      </div>

      {/* Weekly Report Modal */}
      {showReport && report && (
        <div className="modal-overlay" onClick={() => setShowReport(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2>📊 Weekly Report</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              {report.week_summary.start_date} → {report.week_summary.end_date}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Nutrition */}
              <div className="glass" style={{ padding: '1rem' }}>
                <p style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--orange)' }}>🥗 Nutrition</p>
                <div className="grid-2" style={{ gap: '0.5rem' }}>
                  {[
                    ['Avg. Calories/day', report.nutrition.avg_daily_calories + ' kcal'],
                    ['Target', report.nutrition.calorie_target + ' kcal'],
                    ['Avg. Protein/day', report.nutrition.avg_daily_protein + 'g'],
                    ['Days Logged', report.nutrition.days_food_logged + ' / 7'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>{k}</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Workout */}
              <div className="glass" style={{ padding: '1rem' }}>
                <p style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--green)' }}>💪 Workout</p>
                <div className="grid-2" style={{ gap: '0.5rem' }}>
                  {[
                    ['Workout Days', report.workout.workout_days + ' / 7'],
                    ['Total Sets', report.workout.total_sets],
                    ['Best Muscle', report.workout.strongest_muscle],
                    ['Missed Days', report.workout.missed_days],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>{k}</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weight */}
              <div className="glass" style={{ padding: '1rem' }}>
                <p style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#a78bfa' }}>⚖️ Weight Progress</p>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Start:</span> {report.weight.start_weight} kg &nbsp;→&nbsp;
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>End:</span> {report.weight.end_weight} kg
                  {report.weight.change !== null && (
                    <span style={{ color: Number(report.weight.change) < 0 ? 'var(--green)' : 'var(--orange)', fontWeight: 700 }}>
                      &nbsp;({Number(report.weight.change) > 0 ? '+' : ''}{report.weight.change} kg)
                    </span>
                  )}
                  <br />
                  <span style={{ color: 'var(--text-primary)' }}>{report.weight.progress_status}</span>
                </div>
              </div>
            </div>

            <button className="btn-primary" style={{ marginTop: '1.5rem', width: '100%' }} onClick={() => setShowReport(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  remaining: {
    display: 'flex', alignItems: 'center',
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    padding: '1rem 1.5rem', gap: '1rem', flexWrap: 'wrap',
  },
  remainItem: { display: 'flex', flexDirection: 'column', gap: '0.2rem' },
};

export default HomePage;
