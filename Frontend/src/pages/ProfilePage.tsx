// ============================================================
// src/pages/ProfilePage.tsx
// ============================================================
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI, dashboardAPI } from '../services/api';
import { User } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const GOAL_LABELS: Record<string, string> = { weight_loss: '🔥 Weight Loss', weight_gain: '💪 Weight Gain', maintain: '⚖️ Maintain' };

const ProfilePage: React.FC = () => {
  const { user, updateUser, logout } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [editing, setEditing] = useState(false);
  const [weightHistory, setWeightHistory] = useState<{ weight: number; log_date: string }[]>([]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({ weight: '', target_weight: '', goal: '', activity_level: '', gym_status: true });

  useEffect(() => {
    authAPI.getProfile().then(res => {
      const u = res.data.user;
      setProfile(u);
      setForm({ weight: u.weight, target_weight: u.target_weight, goal: u.goal, activity_level: String(u.activity_level), gym_status: u.gym_status });
    });
    dashboardAPI.weightHistory().then(res => setWeightHistory(res.data.history || []));
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await authAPI.updateProfile({
        weight: Number(form.weight),
        target_weight: Number(form.target_weight),
        goal: form.goal,
        activity_level: Number(form.activity_level),
        gym_status: form.gym_status,
      });
      updateUser(res.data.user);
      setProfile(prev => prev ? { ...prev, ...res.data.user } : prev);
      setSuccess('✅ Profile updated!');
      setEditing(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err?.response?.data?.message || 'Update failed'); }
  };

  const chartData = weightHistory.map(w => ({ date: w.log_date.slice(5), weight: Number(w.weight) }));

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
      {error && <div className="msg-error" style={{ marginBottom: '1rem' }}>{error}</div>}

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
              <InfoRow label="Weight"         value={profile?.weight ? `${profile.weight} kg` : undefined} />
              <InfoRow label="Target Weight"  value={profile?.target_weight ? `${profile.target_weight} kg` : undefined} />
              <InfoRow label="Goal"           value={profile?.goal ? GOAL_LABELS[profile.goal] : undefined} />
              <InfoRow label="Gym Status"     value={profile?.gym_status ? '🏋️ Going to gym' : '🏠 Home training'} />
              <InfoRow label="Activity Level" value={profile?.activity_level} />

              {/* Calculated */}
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--green-dim)', borderRadius: 'var(--radius-sm)' }}>
                <p style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--green-light)' }}>⚡ Your Calculated Targets</p>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>DAILY CALORIES</div><div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--orange)' }}>{profile?.daily_calories}</div></div>
                  <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>DAILY PROTEIN</div><div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--blue)' }}>{profile?.daily_protein}g</div></div>
                  <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>BMR</div><div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--green)' }}>{profile?.bmr}</div></div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button className="btn-primary" style={{ flex: 2 }} onClick={() => setEditing(true)}>✏️ Edit Profile</button>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={logout}>Logout</button>
              </div>
            </>
          ) : (
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="grid-2">
                <div>
                  <label className="form-label">Weight (kg)</label>
                  <input className="input-field" type="number" value={form.weight} onChange={e => setForm(p => ({ ...p, weight: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Target Weight (kg)</label>
                  <input className="input-field" type="number" value={form.target_weight} onChange={e => setForm(p => ({ ...p, target_weight: e.target.value }))} />
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
                <button type="submit" className="btn-primary" style={{ flex: 2 }}>Save Changes</button>
              </div>
            </form>
          )}
        </div>

        {/* Weight history chart */}
        <div className="glass fade-in-delay-2" style={{ padding: '1.5rem' }}>
          <p style={{ fontWeight: 800, marginBottom: '1rem' }}>📈 Weight History (30 days)</p>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 8, color: '#f1f5f9' }} />
                <Line type="monotone" dataKey="weight" stroke="var(--green)" strokeWidth={2.5} dot={{ fill: 'var(--green)', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>⚖️</span>
              <p style={{ fontWeight: 600 }}>No weight logs yet</p>
              <p style={{ fontSize: '0.82rem', marginTop: '0.3rem' }}>Log your weight from the Home page</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
