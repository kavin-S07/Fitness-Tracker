// ============================================================
// src/pages/FoodPage.tsx
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import { foodAPI } from '../services/api';
import { FoodEntry } from '../types';

const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const CAT_ICONS: Record<string, string> = {
  Breakfast: '🍳',
  Lunch: '🍱',
  Dinner: '🍽️',
  Snacks: '🍎',
};

interface Summary {
  total_calories: number;
  total_protein: number;
  calorie_target: number;
  protein_target: number;
  remaining_calories: number;
  remaining_protein: number;
}

const FoodPage: React.FC = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    food_name: '',
    calories: '',
    protein: '',
    category: 'Breakfast',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await foodAPI.getByDate(date);
      setFoods(res.data.foods || []);
      setSummary(res.data.summary || null);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.food_name || !form.calories || !form.protein) return setError('Fill all fields');
    try {
      await foodAPI.addFood({
        food_name: form.food_name,
        calories: Number(form.calories),
        protein: Number(form.protein),
        category: form.category,
        date,
      });
      setSuccess('✅ Food added!');
      setForm({ food_name: '', calories: '', protein: '', category: 'Breakfast' });
      setShowForm(false);
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to add food');
    }
  };

  const handleDelete = async (id: number | string) => {
    try {
      await foodAPI.deleteFood(id);
      load();
    } catch { /* ignore */ }
  };

  const byCategory = CATEGORIES.map(cat => ({
    cat,
    items: foods.filter(f => f.category?.toLowerCase() === cat.toLowerCase()),
  }));

  const calPct = summary
    ? Math.min(100, Math.round((summary.total_calories / (summary.calorie_target || 1)) * 100))
    : 0;
  const proPct = summary
    ? Math.min(100, Math.round((summary.total_protein / (summary.protein_target || 1)) * 100))
    : 0;

  return (
    <div className="page-wrap">

      {/* ── Header ── */}
      <div className="fade-in" style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.75rem',
      }}>
        <div>
          <h1 className="section-title">🥗 Food Tracker</h1>
          <p className="section-subtitle">Log your meals and track macros</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="date"
            className="input-field"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ width: 'auto' }}
          />
          <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add Food</button>
        </div>
      </div>

      {success && <div className="msg-success" style={{ marginBottom: '1rem' }}>{success}</div>}

      {/* ── Summary Cards ── */}
      {summary && (
        <div className="grid-4 fade-in-delay-1" style={{ marginBottom: '1.5rem' }}>
          {[
            { label: 'Calories Consumed', value: summary.total_calories, unit: 'kcal', color: 'var(--orange)', pct: calPct },
            { label: 'Protein Consumed',  value: `${summary.total_protein}g`, unit: '', color: 'var(--blue)', pct: proPct },
            { label: 'Calories Target',   value: summary.calorie_target, unit: 'kcal', color: 'var(--text-secondary)', pct: null },
            { label: 'Remaining Cals',    value: summary.remaining_calories, unit: 'kcal', color: summary.remaining_calories < 0 ? 'var(--red)' : 'var(--green)', pct: null },
          ].map((s) => (
            <div className="stat-card" key={s.label}>
              <div className="label">{s.label}</div>
              <div className="value" style={{ color: s.color, fontSize: '1.6rem' }}>
                {s.value} <span style={{ fontSize: '0.9rem' }}>{s.unit}</span>
              </div>
              {s.pct !== null && (
                <div className="progress-bar-track" style={{ marginTop: '0.5rem' }}>
                  <div className="progress-bar-fill" style={{ width: `${s.pct}%`, background: s.color }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Food Log by Category ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="fade-in-delay-2" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {byCategory.map(({ cat, items }) => {
            const catCals = Math.round(items.reduce((s, i) => s + (parseFloat(String(i.calories)) || 0), 0));
            const catPro  = Math.round(items.reduce((s, i) => s + (parseFloat(String(i.protein))  || 0), 0));

            return (
              <div key={cat} className="glass" style={{ padding: '1.25rem 1.5rem', width: '100%', boxSizing: 'border-box' }}>

                {/* Category header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: items.length > 0 ? '1rem' : '0',
                }}>
                  <p style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', margin: 0 }}>
                    {CAT_ICONS[cat]} {cat}
                  </p>
                  {items.length > 0 && (
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {catCals} kcal &nbsp;·&nbsp; {catPro}g protein
                    </span>
                  )}
                </div>

                {/* Empty state */}
                {items.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No items logged</p>
                ) : (
                  /* Food table */
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      tableLayout: 'fixed',
                    }}>
                      <colgroup>
                        <col style={{ width: '50%' }} />
                        <col style={{ width: '22%' }} />
                        <col style={{ width: '22%' }} />
                        <col style={{ width: '6%' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          {['Food', 'Calories', 'Protein', ''].map((h) => (
                            <th key={h} style={{
                              textAlign: 'left',
                              fontSize: '0.72rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              color: 'var(--text-muted)',
                              fontWeight: 700,
                              padding: '0.4rem 0.75rem',
                              borderBottom: '1px solid var(--border)',
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((f, idx) => (
                          <tr key={f.id} style={{
                            background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                          }}>
                            <td style={{
                              padding: '0.7rem 0.75rem',
                              fontWeight: 600,
                              fontSize: '0.9rem',
                              color: 'var(--text-primary)',
                              borderBottom: idx < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {f.food_name}
                            </td>
                            <td style={{
                              padding: '0.7rem 0.75rem',
                              borderBottom: idx < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                            }}>
                              <span className="badge badge-orange">
                                {Math.round(parseFloat(String(f.calories)))} kcal
                              </span>
                            </td>
                            <td style={{
                              padding: '0.7rem 0.75rem',
                              borderBottom: idx < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                            }}>
                              <span className="badge badge-blue">
                                {Math.round(parseFloat(String(f.protein)))}g
                              </span>
                            </td>
                            <td style={{
                              padding: '0.7rem 0.75rem',
                              borderBottom: idx < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                              textAlign: 'right',
                            }}>
                              <button
                                className="btn-danger"
                                onClick={() => handleDelete(f.id)}
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                              >✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Food Modal ── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2>Add Food</h2>
            {error && <div className="msg-error" style={{ marginBottom: '1rem' }}>{error}</div>}
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label">Food Name</label>
                <input
                  className="input-field"
                  placeholder="e.g. Boiled Eggs"
                  value={form.food_name}
                  onChange={e => setForm(p => ({ ...p, food_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Category</label>
                <select
                  className="input-field"
                  value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{CAT_ICONS[c]} {c}</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div>
                  <label className="form-label">Calories (kcal)</label>
                  <input
                    className="input-field"
                    type="number"
                    placeholder="250"
                    min="0"
                    value={form.calories}
                    onChange={e => setForm(p => ({ ...p, calories: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">Protein (g)</label>
                  <input
                    className="input-field"
                    type="number"
                    placeholder="20"
                    min="0"
                    value={form.protein}
                    onChange={e => setForm(p => ({ ...p, protein: e.target.value }))}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 2 }}>Add Food</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FoodPage;