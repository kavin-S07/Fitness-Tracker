// ============================================================
// src/pages/ProfilePage.tsx
// ============================================================
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI, dashboardAPI, progressAPI } from '../services/api';
import { User } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const GOAL_LABELS: Record<string, string> = {
  weight_loss: '🔥 Weight Loss',
  weight_gain: '💪 Weight Gain',
  maintain:    '⚖️ Maintain',
};

const ProfilePage: React.FC = () => {
  const { user, updateUser, logout } = useAuth();
  const [profile,          setProfile]          = useState<User | null>(null);
  const [editing,          setEditing]          = useState(false);
  const [weightHistory,    setWeightHistory]    = useState<{ weight: number; log_date: string }[]>([]);
  const [success,          setSuccess]          = useState('');
  const [error,            setError]            = useState('');
  const [updatingWeight,   setUpdatingWeight]   = useState(false);
  const [showUpdateModal,  setShowUpdateModal]  = useState(false);
  const [afterUpdateDeficit, setAfterUpdateDeficit] = useState(0);
  const [progressData,     setProgressData]     = useState<any>(null);

  const [form, setForm] = useState({
    weight: '', target_weight: '', goal: '', activity_level: '', gym_status: true,
  });

  const loadData = async () => {
    try {
      const profRes  = await authAPI.getProfile();
      const u        = profRes.data.user;
      setProfile(u);
      setForm({
        weight:         String(u.weight         ?? ''),
        target_weight:  String(u.target_weight  ?? ''),
        goal:           u.goal           ?? 'weight_loss',
        activity_level: String(u.activity_level ?? 5),
        gym_status:     u.gym_status     ?? true,
      });
    } catch { /* ignore */ }

    try {
      const histRes = await dashboardAPI.weightHistory();
      setWeightHistory(histRes.data.history || []);
    } catch { /* ignore */ }

    try {
      const progRes = await progressAPI.weekly();
      const prog    = progRes.data.progress;
      setProgressData(prog);
      setAfterUpdateDeficit(prog.afterUpdateDeficit || 0);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadData(); }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await authAPI.updateProfile({
        weight:         Number(form.weight),
        target_weight:  Number(form.target_weight),
        goal:           form.goal,
        activity_level: Number(form.activity_level),
        gym_status:     form.gym_status,
      });
      updateUser(res.data.user);
      setProfile(prev => prev ? { ...prev, ...res.data.user } : prev);
      setSuccess('✅ Profile updated!');
      setEditing(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err?.response?.data?.message || 'Update failed'); }
  };

  const handleUpdateWeight = async () => {
    setUpdatingWeight(true);
    setShowUpdateModal(false);
    try {
      const res = await progressAPI.applyWeekly();
      // Reload everything so all values are in sync
      await loadData();
      const u = (await authAPI.getProfile()).data.user;
      updateUser(u);
      setSuccess(res.data.message || '✅ Weight updated & targets recalculated!');
      setTimeout(() => setSuccess(''), 4000);
    } catch {
      setError('Failed to update weight.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setUpdatingWeight(false);
    }
  };

  const chartData = weightHistory.map(w => ({
    date:   w.log_date.slice(5),
    weight: Number(w.weight),
  }));

  // ── Derived display values (all from server, no client-side recalc) ──
  const currentWeight     = profile?.weight                  ?? 0;
  const targetWeight      = profile?.target_weight           ?? null;
  const maintenanceCalories = profile?.maintenance_calories  ?? 0;
  const dailyCalories     = profile?.daily_calories          ?? 0;
  const dailyDeficit      = dailyCalories - maintenanceCalories; // negative = deficit
  const bmr               = profile?.bmr                     ?? 0;

  // Weight remaining from target
  const weightRemaining   = targetWeight != null
    ? parseFloat((targetWeight - currentWeight).toFixed(2))
    : null;

  // BMI
  const heightM = (profile?.height ?? 0) / 100;
  const bmi     = heightM > 0 ? parseFloat((currentWeight / (heightM * heightM)).toFixed(1)) : null;

  const InfoRow = ({ label, value }: { label: string; value: string | number | undefined }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{value ?? '—'}</span>
    </div>
  );

  return (
    <div className="page-wrap">
      <div style={{ marginBottom: '1.75rem' }} className="fade-in">
        <h1 className="section-title">👤 Profile</h1>
        <p className="section-subtitle">Your stats & fitness settings</p>
      </div>

      {success && <div className="msg-success" style={{ marginBottom: '1rem' }}>{success}</div>}
      {error   && <div className="msg-error"   style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="grid-2" style={{ marginBottom: '1.5rem', alignItems: 'start' }}>
        {/* Profile card */}
        <div className="glass fade-in-delay-1" style={{ padding: '1.75rem' }}>
          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-dim)', border: '2px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>
              {profile?.name?.[0]?.toUpperCase() || '👤'}
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', letterSpacing: '0.03em' }}>{profile?.name}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{profile?.email}</p>
            </div>
          </div>

          {!editing ? (
            <>
              <InfoRow label="Age"            value={profile?.age} />
              <InfoRow label="Gender"         value={profile?.gender} />
              <InfoRow label="Height"         value={profile?.height ? `${profile.height} cm` : undefined} />
              <InfoRow label="Weight"         value={currentWeight ? `${currentWeight} kg` : undefined} />
              <InfoRow label="Target Weight"  value={targetWeight  ? `${targetWeight} kg`  : undefined} />
              <InfoRow label="Goal"           value={profile?.goal ? GOAL_LABELS[profile.goal] : undefined} />
              <InfoRow label="Gym Status"     value={profile?.gym_status ? '🏋️ Going to gym' : '🏠 Home training'} />
              <InfoRow label="Activity Level" value={profile?.activity_level} />
              <InfoRow label="BMI"            value={bmi ?? undefined} />

              {/* Calculated Targets */}
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--green-dim)', borderRadius: 'var(--radius-sm)' }}>
                <p style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--green-light)' }}>⚡ Your Calculated Targets</p>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={s.lbl}>BMR</div>
                    <div style={{ ...s.val, color: 'var(--green)' }}>{bmr}</div>
                    <div style={s.unit}>kcal/day</div>
                  </div>
                  <div>
                    <div style={s.lbl}>Maintenance</div>
                    <div style={{ ...s.val, color: 'var(--orange)' }}>{maintenanceCalories}</div>
                    <div style={s.unit}>kcal/day</div>
                  </div>
                  <div>
                    <div style={s.lbl}>Target Calories</div>
                    <div style={{ ...s.val, color: '#f59e0b' }}>{dailyCalories}</div>
                    <div style={s.unit}>kcal/day</div>
                  </div>
                  <div>
                    <div style={s.lbl}>Daily Protein</div>
                    <div style={{ ...s.val, color: 'var(--blue)' }}>{profile?.daily_protein}g</div>
                    <div style={s.unit}>target</div>
                  </div>
                  <div>
                    <div style={s.lbl}>{dailyDeficit < 0 ? 'Deficit/day' : dailyDeficit > 0 ? 'Surplus/day' : 'Maintenance'}</div>
                    <div style={{ ...s.val, color: dailyDeficit < 0 ? 'var(--red, #ef4444)' : dailyDeficit > 0 ? 'var(--green)' : 'var(--text-muted)' }}>
                      {dailyDeficit !== 0 ? `${Math.abs(dailyDeficit)} kcal` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={s.lbl}>After Update Deficit</div>
                    <div style={{ ...s.val, color: afterUpdateDeficit >= 0 ? 'var(--green)' : 'var(--red, #ef4444)' }}>
                      {afterUpdateDeficit >= 0 ? '+' : ''}{afterUpdateDeficit} kcal
                    </div>
                  </div>
                </div>
                <button
                  className="btn-primary"
                  style={{ marginTop: '0.85rem', width: '100%' }}
                  onClick={() => setShowUpdateModal(true)}
                  disabled={updatingWeight}
                >
                  {updatingWeight ? '⏳ Updating...' : '🔄 Update Weight'}
                </button>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
                  Saves current deficit, recalculates targets, and resets the tracking cycle
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button className="btn-primary"   style={{ flex: 2 }} onClick={() => setEditing(true)}>✏️ Edit Profile</button>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={logout}>Logout</button>
              </div>
            </>
          ) : (
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="grid-2">
                <div>
                  <label className="form-label">Weight (kg)</label>
                  <input className="input-field" type="number" step="0.1" value={form.weight} onChange={e => setForm(p => ({ ...p, weight: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Target Weight (kg)</label>
                  <input className="input-field" type="number" step="0.1" value={form.target_weight} onChange={e => setForm(p => ({ ...p, target_weight: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="form-label">Goal</label>
                <select className="input-field" value={form.goal} onChange={e => setForm(p => ({ ...p, goal: e.target.value }))}>
                  <option value="weight_loss">Weight Loss</option>
                  <option value="weight_gain">Weight Gain</option>
                  <option value="maintain">Maintain</option>
                </select>
              </div>
              <div>
                <label className="form-label">Activity Level: {form.activity_level}</label>
                <input type="range" className="input-field" min="1" max="10" value={form.activity_level}
                  onChange={e => setForm(p => ({ ...p, activity_level: e.target.value }))} style={{ padding: '0.25rem 0' }} />
              </div>
              <div>
                <label className="form-label">Gym Status</label>
                <select className="input-field" value={String(form.gym_status)} onChange={e => setForm(p => ({ ...p, gym_status: e.target.value === 'true' }))}>
                  <option value="true">Going to gym</option>
                  <option value="false">Not going</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setEditing(false)}>Cancel</button>
                <button type="submit"  className="btn-primary"  style={{ flex: 2 }}>Save Changes</button>
              </div>
            </form>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Weight history chart */}
          <div className="glass fade-in-delay-2" style={{ padding: '1.5rem' }}>
            <p style={{ fontWeight: 800, marginBottom: '1rem' }}>📈 Weight History (30 days)</p>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 8, color: '#f1f5f9' }} />
                  <Line type="monotone" dataKey="weight" stroke="var(--green)" strokeWidth={2.5} dot={{ fill: 'var(--green)', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 220, color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>⚖️</span>
                <p style={{ fontWeight: 600 }}>No weight logs yet</p>
                <p style={{ fontSize: '0.82rem', marginTop: '0.3rem' }}>Log your weight from the Home page</p>
              </div>
            )}
          </div>

          {/* Weight progress card */}
          <div className="glass fade-in-delay-2" style={{ padding: '1.5rem' }}>
            <p style={{ fontWeight: 800, marginBottom: '1rem' }}>⚖️ Weight Progress</p>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div>
                <div style={s.lbl}>Current Weight</div>
                <div style={{ ...s.bigVal, color: 'var(--text-primary)' }}>{currentWeight} kg</div>
              </div>
              <div>
                <div style={s.lbl}>Target Weight</div>
                <div style={{ ...s.bigVal, color: 'var(--text-primary)' }}>{targetWeight ? `${targetWeight} kg` : '—'}</div>
              </div>
              <div>
                <div style={s.lbl}>Weight Remaining</div>
                <div style={{
                  ...s.bigVal,
                  color: weightRemaining !== null
                    ? (weightRemaining === 0 ? 'var(--green)' : weightRemaining > 0 ? 'var(--blue)' : 'var(--orange)')
                    : 'var(--text-muted)',
                }}>
                  {weightRemaining !== null
                    ? `${weightRemaining > 0 ? '+' : ''}${weightRemaining.toFixed(1)} kg`
                    : '—'}
                </div>
              </div>
              {bmi && (
                <div>
                  <div style={s.lbl}>BMI</div>
                  <div style={{ ...s.bigVal, color: bmi < 18.5 ? 'var(--blue)' : bmi < 25 ? 'var(--green)' : bmi < 30 ? 'var(--orange)' : 'var(--red, #ef4444)' }}>
                    {bmi}
                  </div>
                </div>
              )}
            </div>

            {/* After-update summary */}
            {progressData?.previousWeight != null && (
              <div style={{ marginTop: '1rem', padding: '0.85rem', background: 'rgba(59,130,246,0.08)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--blue)' }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--blue)', marginBottom: '0.5rem' }}>📋 After Last Update</p>
                <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={s.lbl}>Previous Weight</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>{progressData.previousWeight} kg</div>
                  </div>
                  <div>
                    <div style={s.lbl}>Deficit Since Update</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--green)' }}>
                      +{progressData.afterUpdateDeficit} kcal
                    </div>
                  </div>
                  <div>
                    <div style={s.lbl}>Days Since Update</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>{progressData.daysSinceUpdate} days</div>
                  </div>
                  {progressData.predictedWeight != null && (
                    <div>
                      <div style={s.lbl}>Predicted Weight</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--blue)' }}>
                        {progressData.predictedWeight} kg
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {dailyDeficit < 0
                ? `Daily deficit of ${Math.abs(dailyDeficit)} kcal from your maintenance of ${maintenanceCalories} kcal. ~1 kg ≈ 7,700 kcal.`
                : dailyDeficit > 0
                ? `Daily surplus of ${Math.abs(dailyDeficit)} kcal above your maintenance of ${maintenanceCalories} kcal. ~1 kg ≈ 7,700 kcal.`
                : `On maintenance calories (${maintenanceCalories} kcal). ~1 kg ≈ 7,700 kcal.`}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation modal */}
      {showUpdateModal && (
        <div className="modal-overlay" onClick={() => setShowUpdateModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h2 style={{ marginBottom: '0.75rem' }}>🔄 Update Weight</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '0.75rem' }}>
              This will:
            </p>
            <ul style={{ color: 'var(--text-secondary)', lineHeight: 2, marginBottom: '1.5rem', paddingLeft: '1.2rem', fontSize: '0.9rem' }}>
              <li>Save your accumulated calorie deficit ({afterUpdateDeficit.toLocaleString()} kcal)</li>
              <li>Recalculate your BMR, maintenance, and target calories</li>
              <li>Reset the deficit counter for the new tracking cycle</li>
            </ul>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowUpdateModal(false)} disabled={updatingWeight}>Cancel</button>
              <button className="btn-primary"   style={{ flex: 1 }} onClick={handleUpdateWeight}              disabled={updatingWeight}>
                {updatingWeight ? '⏳ Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  lbl:    { fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' },
  val:    { fontFamily: 'var(--font-display)', fontSize: '1.35rem' },
  bigVal: { fontFamily: 'var(--font-display)', fontSize: '1.6rem' },
  unit:   { fontSize: '0.75rem', color: 'var(--text-muted)' },
};

export default ProfilePage;
