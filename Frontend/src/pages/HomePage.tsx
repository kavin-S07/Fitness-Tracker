// ============================================================
// src/pages/HomePage.tsx  –  Dashboard
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI, progressAPI } from '../services/api';
import { Dashboard, WeeklyProgress, WeightHistoryRecord } from '../types';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid,
} from 'recharts';

const GoalLabel: Record<string, string> = {
  weight_loss: '🔥 Weight Loss',
  weight_gain: '💪 Weight Gain',
  maintain:    '⚖️ Maintain',
};

// ── small display helpers ─────────────────────────────────────
const Stat = ({
  label, value, unit, color,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  color?: string;
}) => (
  <div>
    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {label}
    </div>
    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.45rem', color: color || 'var(--text-primary)', lineHeight: 1.2 }}>
      {value}
      {unit && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 2 }}>{unit}</span>}
    </div>
  </div>
);

const Row = ({ k, v, color }: { k: string; v: string; color?: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>{k}</span>
    <span style={{ fontWeight: 700, color: color || 'var(--text-primary)', fontSize: '0.9rem' }}>{v}</span>
  </div>
);

// ── component ─────────────────────────────────────────────────
const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [data,           setData]           = useState<Dashboard | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [weightInput,    setWeightInput]    = useState('');
  const [weightMsg,      setWeightMsg]      = useState('');
  const [showReport,     setShowReport]     = useState(false);
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgress | null>(null);
  const [weightHistory,  setWeightHistory]  = useState<WeightHistoryRecord[]>([]);

  const load = useCallback(async () => {
    try {
      const dashRes = await dashboardAPI.get();
      setData(dashRes.data.dashboard);
    } catch { /* ignore */ }
    try {
      const progRes = await progressAPI.weekly();
      setWeeklyProgress(progRes.data.progress);
    } catch { /* ignore */ }
    try {
      const histRes = await progressAPI.history();
      setWeightHistory(histRes.data.history || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const logWeight = async () => {
    if (!weightInput) return;
    try {
      await dashboardAPI.logWeight(Number(weightInput));
      setWeightMsg('✅ Weight logged & targets updated!');
      setWeightInput('');
      load();
      setTimeout(() => setWeightMsg(''), 3000);
    } catch { setWeightMsg('❌ Failed to log weight.'); }
  };

  if (loading) return (
    <div className="page-wrap" style={{ display: 'flex', justifyContent: 'center', paddingTop: '5rem' }}>
      <div className="spinner" />
    </div>
  );

  const today = data?.today;
  const u     = data?.user;
  const wp    = weeklyProgress;

  const calPct = u ? Math.min(100, Math.round(((today?.calories_consumed || 0) / (u.daily_calories_target || 1)) * 100)) : 0;
  const proPct = u ? Math.min(100, Math.round(((today?.protein_consumed  || 0) / (u.daily_protein_target  || 1)) * 100)) : 0;

  // Safe date slicer — works on both 'YYYY-MM-DD' and legacy ISO strings
  const toMMDD = (s: string) => (s || '').replace(/T.*/, '').slice(5);

  const chartData = data?.weekly_food_chart.map(d => ({
    date:     toMMDD(d.date),
    Calories: Math.round(Number(d.calories)),
    Protein:  Math.round(Number(d.protein)),
  })) || [];

  const workoutChart = data?.weekly_workout_chart.map(d => ({
    date: toMMDD(d.workout_date),
    Sets: Number(d.total_sets),
  })) || [];

  // ── colours ───────────────────────────────────────────────
  const deficitColor  = (v: number) => v >= 0 ? 'var(--green)' : '#ef4444';
  const remainColor   = (v: number | null) =>
    v == null ? 'var(--text-muted)' : v === 0 ? 'var(--green)' : v > 0 ? 'var(--blue)' : '#ef4444';

  // ── Weekly Report data comes from weeklyProgress (always fresh) ──
  const weekStart = wp?.days?.[0]?.date ?? '—';
  const weekEnd   = wp?.days?.[wp.days.length - 1]?.date ?? '—';

  // Per-day calorie deficit sum (the correct number after SQL fix)
  const totalWeekDeficit = wp?.currentWeeklyDeficit ?? 0;
  const daysTracked      = wp?.days?.length ?? 0;
  const avgDailyDeficit  = daysTracked > 0 ? Math.round(totalWeekDeficit / daysTracked) : 0;
  const avgConsumed      = daysTracked > 0
    ? Math.round((wp?.days ?? []).reduce((s, d) => s + d.consumedCalories, 0) / daysTracked)
    : 0;

  return (
    <div className="page-wrap">

      {/* ── Header ── */}
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

      {/* ── Today stat cards ── */}
      <div className="grid-4 fade-in-delay-1" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="label">Calories Today</div>
          <div className="value" style={{ color: 'var(--orange)' }}>{today?.calories_consumed ?? 0}</div>
          <div className="sub">/ {u?.daily_calories_target} kcal target</div>
          <div className="progress-bar-track" style={{ marginTop: '0.6rem' }}>
            <div className="progress-bar-fill" style={{ width: `${calPct}%`, background: 'linear-gradient(90deg,var(--orange),#fb923c)' }} />
          </div>
        </div>

        <div className="stat-card">
          <div className="label">Protein Today</div>
          <div className="value" style={{ color: 'var(--blue)' }}>{today?.protein_consumed ?? 0}g</div>
          <div className="sub">/ {u?.daily_protein_target}g target</div>
          <div className="progress-bar-track" style={{ marginTop: '0.6rem' }}>
            <div className="progress-bar-fill" style={{ width: `${proPct}%`, background: 'linear-gradient(90deg,var(--blue),#60a5fa)' }} />
          </div>
        </div>

        <div className="stat-card">
          <div className="label">Current Weight</div>
          <div className="value" style={{ color: 'var(--green)' }}>
            {u?.current_weight ?? user?.weight ?? '–'}<span style={{ fontSize: '1rem' }}> kg</span>
          </div>
          <div className="sub">Target: {u?.target_weight ?? '–'} kg</div>
          {u?.bmi != null && <div className="sub">BMI: <strong>{u.bmi}</strong></div>}
        </div>

        <div className="stat-card">
          <div className="label">Today's Workout</div>
          <div className="value" style={{ color: '#a78bfa' }}>{today?.workout_sets ?? 0}<span style={{ fontSize: '1rem' }}> sets</span></div>
          <div className="sub">{today?.muscle_groups_trained || 'No workout yet'}</div>
        </div>
      </div>

      {/* ── Calorie targets row ── */}
      <div className="grid-4 fade-in-delay-1" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="label">BMR</div>
          <div className="value" style={{ color: 'var(--green)', fontSize: '1.4rem' }}>{u?.bmr ?? '–'}</div>
          <div className="sub">kcal / day base</div>
        </div>
        <div className="stat-card">
          <div className="label">Maintenance</div>
          <div className="value" style={{ color: 'var(--orange)', fontSize: '1.4rem' }}>{u?.maintenance_calories ?? '–'}</div>
          <div className="sub">kcal / day TDEE</div>
        </div>
        <div className="stat-card">
          <div className="label">Target Calories</div>
          <div className="value" style={{ color: '#f59e0b', fontSize: '1.4rem' }}>{u?.daily_calories_target ?? '–'}</div>
          <div className="sub">kcal / day goal</div>
        </div>
        <div className="stat-card">
          <div className="label">Weight Remaining</div>
          <div className="value" style={{ color: remainColor(u?.weight_remaining ?? null), fontSize: '1.4rem' }}>
            {u?.weight_remaining != null ? `${u.weight_remaining > 0 ? '+' : ''}${u.weight_remaining} kg` : '—'}
          </div>
          <div className="sub">to reach target</div>
        </div>
      </div>

      {/* ── Remaining callout ── */}
      <div style={S.remaining} className="fade-in-delay-2">
        <div style={S.remainItem}>
          <span style={S.remLabel}>Calories Remaining</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: (today?.calories_remaining ?? 0) < 0 ? '#ef4444' : 'var(--green)' }}>
            {today?.calories_remaining ?? 0} kcal
          </span>
        </div>
        <div style={{ width: 1, background: 'var(--border)', margin: '0 1rem' }} />
        <div style={S.remainItem}>
          <span style={S.remLabel}>Protein Remaining</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: (today?.protein_remaining ?? 0) < 0 ? '#ef4444' : 'var(--blue)' }}>
            {today?.protein_remaining ?? 0}g
          </span>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn-secondary" onClick={() => setShowReport(true)} style={{ fontSize: '0.82rem' }}>
            📊 Weekly Report
          </button>
        </div>
      </div>

      {/* ── Weekly Progress card ── */}
      {wp && (
        <div className="glass fade-in-delay-2" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.85rem' }}>📅 Weekly Progress</p>
          <div className="grid-4" style={{ gap: '1.25rem' }}>
            <Stat label="Current Weight"    value={wp.currentWeight}  unit="kg" />
            <Stat label="Target Weight"     value={wp.targetWeight ?? '—'} unit={wp.targetWeight ? 'kg' : undefined} />
            <Stat
              label="Remaining"
              value={wp.remainingWeight != null ? `${wp.remainingWeight >= 0 ? '+' : ''}${wp.remainingWeight} kg` : '—'}
              color={remainColor(wp.remainingWeight)}
            />
            <Stat
              label="This Week Deficit"
              value={`${wp.currentWeeklyDeficit >= 0 ? '+' : ''}${wp.currentWeeklyDeficit}`}
              unit="kcal"
              color={deficitColor(wp.currentWeeklyDeficit)}
            />
            <Stat
              label="Last Week Deficit"
              value={(wp.lastWeekDeficit ?? 0).toLocaleString()}
              unit="kcal"
              color="var(--orange)"
            />
            <Stat
              label="Last Week Δ Weight"
              value={`${(wp.lastWeekWeightChange ?? 0) >= 0 ? '-' : '+'}${Math.abs(wp.lastWeekWeightChange ?? 0).toFixed(2)}`}
              unit="kg"
              color={(wp.lastWeekWeightChange ?? 0) >= 0 ? 'var(--green)' : 'var(--orange)'}
            />
            <Stat
              label="Est. Next Monday"
              value={wp.estimatedNextMonday != null ? `${wp.estimatedNextMonday} kg` : '—'}
            />
            {wp.latestWeightHistory && (
              <Stat
                label="Previous Update"
                value={`${wp.latestWeightHistory.old_weight} → ${wp.latestWeightHistory.new_weight} kg`}
                color="var(--text-muted)"
              />
            )}
          </div>

          {/* Per-day breakdown table */}
          {wp.days.length > 0 && (
            <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>Target</th>
                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>Consumed</th>
                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>Remaining</th>
                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>Deficit</th>
                  </tr>
                </thead>
                <tbody>
                  {wp.days.map(d => (
                    <tr key={d.date} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.45rem 0.6rem', color: 'var(--text-secondary)' }}>{toMMDD(String(d.date))}</td>
                      <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center' }}>{d.targetCalories}</td>
                      <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center', color: 'var(--orange)' }}>{d.consumedCalories}</td>
                      <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center', color: d.remainingCalories >= 0 ? 'var(--green)' : '#ef4444' }}>
                        {d.remainingCalories >= 0 ? '+' : ''}{d.remainingCalories}
                      </td>
                      <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center', fontWeight: 700, color: d.actualDeficit >= 0 ? 'var(--green)' : '#ef4444' }}>
                        {d.actualDeficit >= 0 ? '+' : ''}{d.actualDeficit}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 800 }}>
                    <td style={{ padding: '0.5rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Total</td>
                    <td />
                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center', color: 'var(--orange)' }}>
                      {wp.days.reduce((s, d) => s + d.consumedCalories, 0)}
                    </td>
                    <td />
                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center', color: deficitColor(totalWeekDeficit) }}>
                      {totalWeekDeficit >= 0 ? '+' : ''}{totalWeekDeficit} kcal
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── After Last Update Report ── */}
      {wp && wp.previousWeight != null && (
        <div className="glass fade-in-delay-2" style={{ padding: '1.25rem', marginBottom: '1.5rem', borderLeft: '3px solid var(--blue)' }}>
          <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.85rem', color: 'var(--blue)' }}>
            📋 After Last Update Report
          </p>
          <div className="grid-4" style={{ gap: '1.25rem' }}>
            <Stat label="Current Weight"      value={wp.currentWeight}  unit="kg" />
            <Stat label="Target Weight"       value={wp.targetWeight ?? '—'} unit={wp.targetWeight ? 'kg' : undefined} />
            <Stat
              label="Weight Remaining"
              value={wp.remainingWeight != null ? `${wp.remainingWeight >= 0 ? '+' : ''}${wp.remainingWeight} kg` : '—'}
              color={remainColor(wp.remainingWeight)}
            />
            <Stat
              label="After Update Deficit"
              value={`${wp.afterUpdateDeficit >= 0 ? '+' : ''}${wp.afterUpdateDeficit}`}
              unit="kcal"
              color={deficitColor(wp.afterUpdateDeficit)}
            />
            <Stat
              label="Last Update Deficit"
              value={wp.lastUpdateDeficit != null ? wp.lastUpdateDeficit.toLocaleString() : '—'}
              unit={wp.lastUpdateDeficit != null ? 'kcal' : undefined}
              color="var(--orange)"
            />
            <Stat label="Previous Weight"     value={wp.previousWeight} unit="kg" color="var(--text-muted)" />
            <Stat
              label="Weight Change"
              value={wp.weightChange != null ? `${wp.weightChange >= 0 ? '+' : ''}${wp.weightChange.toFixed(2)} kg` : '—'}
              color={wp.weightChange != null ? (wp.weightChange <= 0 ? 'var(--green)' : 'var(--orange)') : 'var(--text-muted)'}
            />
            <Stat label="Days Since Update"   value={wp.daysSinceUpdate} unit={`day${wp.daysSinceUpdate !== 1 ? 's' : ''}`} />
            <Stat
              label="Predicted Weight"
              value={wp.predictedWeight != null ? `${wp.predictedWeight} kg` : '—'}
              color={wp.predictedWeight != null ? 'var(--blue)' : 'var(--text-muted)'}
            />
          </div>
        </div>
      )}

      {/* ── Charts ── */}
      <div className="grid-2 fade-in-delay-3" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="glass" style={{ padding: '1.25rem' }}>
          <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem' }}>📈 Weekly Calories</p>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}   />
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

      {/* ── Log weight ── */}
      <div className="glass" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <p style={{ fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>⚖️ Log Today's Weight</p>
        <input
          className="input-field"
          type="number"
          step="0.1"
          placeholder="e.g. 70.5"
          value={weightInput}
          onChange={(e) => setWeightInput(e.target.value)}
          style={{ maxWidth: 160 }}
        />
        <button className="btn-primary" onClick={logWeight} style={{ padding: '0.65rem 1.25rem' }}>Log</button>
        {weightMsg && <span style={{ color: weightMsg.startsWith('✅') ? 'var(--green)' : '#ef4444', fontSize: '0.88rem' }}>{weightMsg}</span>}
      </div>

      {/* ── Weight Progress History table ── */}
      {weightHistory.length > 0 && (
        <div className="glass fade-in-delay-3" style={{ padding: '1.25rem', marginTop: '1.5rem' }}>
          <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem' }}>📋 Weight Progress History</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.06em' }}>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Period</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Weight change</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Deficit (kcal)</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Δ kg</th>
                </tr>
              </thead>
              <tbody>
                {weightHistory.map((w) => {
                  const onTrack     = w.goal === 'weight_loss' ? w.weight_change < 0 : w.weight_change > 0;
                  const changeColor = onTrack ? 'var(--green)' : 'var(--orange)';
                  const prefix      = w.weight_change >= 0 ? '+' : '';
                  return (
                    <tr key={w.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.6rem 0.75rem' }}>{toMMDD(w.week_start)} – {toMMDD(w.week_end)}</td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                        {w.old_weight} → <strong>{w.new_weight}</strong> kg
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', color: 'var(--orange)', fontWeight: 700 }}>
                        {(w.weekly_calories ?? 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', color: changeColor, fontWeight: 700 }}>
                        {prefix}{Math.abs(w.weight_change).toFixed(2)} kg
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Weekly Report Modal ── */}
      {showReport && wp && (
        <div className="modal-overlay" onClick={() => setShowReport(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0 }}>📊 Weekly Report</h2>
              <button className="btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }} onClick={() => setShowReport(false)}>✕</button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
              {weekStart} → {weekEnd} · {daysTracked} day{daysTracked !== 1 ? 's' : ''} tracked
            </p>

            {/* ── Nutrition section ── */}
            <div className="glass" style={{ padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--orange)', fontSize: '0.9rem' }}>🥗 Nutrition</p>
              <Row k="Calorie target / day"    v={`${u?.daily_calories_target ?? '—'} kcal`} />
              <Row k="Avg consumed / day"      v={`${avgConsumed} kcal`} />
              <Row k="Avg deficit / day"       v={`${avgDailyDeficit >= 0 ? '+' : ''}${avgDailyDeficit} kcal`}
                   color={deficitColor(avgDailyDeficit)} />
              <Row k="Total deficit this week" v={`${totalWeekDeficit >= 0 ? '+' : ''}${totalWeekDeficit} kcal`}
                   color={deficitColor(totalWeekDeficit)} />
              <Row k="Days tracked"            v={`${daysTracked} / 7`} />
              <Row k="Protein target / day"    v={`${u?.daily_protein_target ?? '—'} g`} />
            </div>

            {/* ── Weight section ── */}
            <div className="glass" style={{ padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#a78bfa', fontSize: '0.9rem' }}>⚖️ Weight</p>
              <Row k="Current weight"          v={`${wp.currentWeight} kg`} />
              <Row k="Target weight"           v={wp.targetWeight != null ? `${wp.targetWeight} kg` : '—'} />
              <Row k="Weight remaining"
                   v={wp.remainingWeight != null ? `${wp.remainingWeight >= 0 ? '+' : ''}${wp.remainingWeight} kg` : '—'}
                   color={remainColor(wp.remainingWeight)} />
              <Row k="This week deficit"
                   v={`${wp.currentWeeklyDeficit >= 0 ? '+' : ''}${wp.currentWeeklyDeficit} kcal`}
                   color={deficitColor(wp.currentWeeklyDeficit)} />
              <Row k="Last week deficit"       v={`${(wp.lastWeekDeficit ?? 0).toLocaleString()} kcal`} color="var(--orange)" />
              <Row k="Last week Δ weight"
                   v={`${(wp.lastWeekWeightChange ?? 0) >= 0 ? '-' : '+'}${Math.abs(wp.lastWeekWeightChange ?? 0).toFixed(2)} kg`}
                   color={(wp.lastWeekWeightChange ?? 0) >= 0 ? 'var(--green)' : 'var(--orange)'} />
              <Row k="Est. next Monday"        v={wp.estimatedNextMonday != null ? `${wp.estimatedNextMonday} kg` : '—'} />
              <Row k="BMR"                     v={`${u?.bmr ?? '—'} kcal`} color="var(--green)" />
              <Row k="Maintenance (TDEE)"      v={`${u?.maintenance_calories ?? '—'} kcal`} color="var(--orange)" />
              {u?.bmi != null && <Row k="BMI" v={String(u.bmi)} />}
            </div>

            {/* ── After last update section ── */}
            {wp.previousWeight != null && (
              <div className="glass" style={{ padding: '1rem', marginBottom: '1rem', borderLeft: '3px solid var(--blue)' }}>
                <p style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--blue)', fontSize: '0.9rem' }}>📋 After Last Update</p>
                <Row k="Previous weight"       v={`${wp.previousWeight} kg`} color="var(--text-muted)" />
                <Row k="Current weight"        v={`${wp.currentWeight} kg`} />
                <Row k="Weight change"
                     v={wp.weightChange != null ? `${wp.weightChange >= 0 ? '+' : ''}${wp.weightChange.toFixed(2)} kg` : '—'}
                     color={wp.weightChange != null ? (wp.weightChange <= 0 ? 'var(--green)' : 'var(--orange)') : undefined} />
                <Row k="Deficit since update"
                     v={`${wp.afterUpdateDeficit >= 0 ? '+' : ''}${wp.afterUpdateDeficit} kcal`}
                     color={deficitColor(wp.afterUpdateDeficit)} />
                <Row k="Last update deficit"   v={wp.lastUpdateDeficit != null ? `${wp.lastUpdateDeficit.toLocaleString()} kcal` : '—'} color="var(--orange)" />
                <Row k="Days since update"     v={`${wp.daysSinceUpdate} day${wp.daysSinceUpdate !== 1 ? 's' : ''}`} />
                <Row k="Predicted weight"      v={wp.predictedWeight != null ? `${wp.predictedWeight} kg` : '—'} color="var(--blue)" />
              </div>
            )}

            {/* ── Per-day breakdown ── */}
            {wp.days.length > 0 && (
              <div className="glass" style={{ padding: '1rem', marginBottom: '1rem' }}>
                <p style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>📆 Daily Breakdown</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.35rem 0.5rem', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>Target</th>
                      <th style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>Eaten</th>
                      <th style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>Remaining</th>
                      <th style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>Deficit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wp.days.map(d => (
                      <tr key={d.date} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-secondary)' }}>{toMMDD(String(d.date))}</td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>{d.targetCalories}</td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: 'var(--orange)' }}>{d.consumedCalories}</td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: d.remainingCalories >= 0 ? 'var(--green)' : '#ef4444' }}>
                          {d.remainingCalories >= 0 ? '+' : ''}{d.remainingCalories}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 700, color: d.actualDeficit >= 0 ? 'var(--green)' : '#ef4444' }}>
                          {d.actualDeficit >= 0 ? '+' : ''}{d.actualDeficit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 800 }}>
                      <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total</td>
                      <td />
                      <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: 'var(--orange)' }}>
                        {wp.days.reduce((s, d) => s + d.consumedCalories, 0)}
                      </td>
                      <td />
                      <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: deficitColor(totalWeekDeficit) }}>
                        {totalWeekDeficit >= 0 ? '+' : ''}{totalWeekDeficit}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <button className="btn-primary" style={{ width: '100%' }} onClick={() => setShowReport(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── styles ────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  remaining: {
    display: 'flex', alignItems: 'center',
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '1rem 1.5rem',
    gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem',
  },
  remainItem: { display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  remLabel:   { color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' },
};

export default HomePage;
