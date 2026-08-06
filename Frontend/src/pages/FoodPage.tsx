// ============================================================
// src/pages/FoodPage.tsx
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import { foodAPI } from '../services/api';
import { FoodEntry } from '../types';
import FoodAutocompleteInput from '../components/FoodAutocompleteInput';
import SuggestMealPanel from '../components/SuggestMealPanel';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
interface HistoryRow {
  date: string;
  total_calories: number;
  total_protein: number;
  food_count: number;
}

interface DayDetail {
  foods: FoodEntry[];
  summary: {
    total_calories: number;
    total_protein: number;
    calorie_target: number;
    protein_target: number;
    remaining_calories: number;
    remaining_protein: number;
  };
}

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------
const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const;
const CAT_ICONS = Object.freeze({
  Breakfast: '🍳',
  Lunch: '🥗',
  Dinner: '🍽️',
  Snacks: '🥜',
} as const);
const CAT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  Breakfast: { bg: 'rgba(234,108,0,0.08)', text: '#ea6c00', dot: '#ea6c00' },
  Lunch:     { bg: 'rgba(22,163,74,0.08)',  text: '#15803d', dot: '#16a34a' },
  Dinner:    { bg: 'rgba(29,78,216,0.08)',  text: '#1d4ed8', dot: '#1d4ed8' },
  Snacks:    { bg: 'rgba(220,38,38,0.06)',  text: '#dc2626', dot: '#dc2626' },
};
const ITEMS_PER_PAGE = 7;

// ------------------------------------------------------------------
// Helper: Format date safely
// ------------------------------------------------------------------
// Used throughout the Food page whenever a date needs to be displayed.
// Safely parses a date string and returns it broken into day/month/year/weekday parts.
function formatDate(dateStr: string) {
  const raw = typeof dateStr === 'string' && dateStr.includes('T')
    ? dateStr.split('T')[0]
    : dateStr;
  const parts = raw.split('-');
  if (parts.length === 3) {
    const year  = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day   = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return {
        day:     day.toString().padStart(2, '0'),
        month:   d.toLocaleString('default', { month: 'short' }).toUpperCase(),
        year,
        weekday: d.toLocaleString('default', { weekday: 'long' }),
        full:    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
        iso:     raw,
      };
    }
  }
  // Fallback: parse manually to avoid UTC timezone offset shifting the date
  const parts2 = dateStr.replace(/T.*/, '').split('-');
  const iso2 = parts2.length === 3 ? parts2.join('-') : dateStr.split('T')[0];
  return { day: '??', month: '???', year: 0, weekday: 'Invalid date', full: dateStr, iso: iso2 };
}

// ------------------------------------------------------------------
// Sub-component: Progress Ring
// ------------------------------------------------------------------
// Used on the Food page to show calorie/protein progress toward the daily target.
// Renders a circular progress ring with a percentage and label.
const ProgressRing: React.FC<{
  value: number; max: number; size?: number; color: string; label: string; sub: string;
}> = ({ value, max, size = 88, color, label, sub }) => {
  const pct  = max > 0 ? Math.min(1, value / max) : 0;
  const r    = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1)' }} />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
          style={{ transform: 'rotate(90deg)', transformOrigin: `${size/2}px ${size/2}px` }}
          fill="#0f172a" fontSize="13" fontWeight="700" fontFamily="Nunito, sans-serif">
          {Math.round(pct * 100)}%
        </text>
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: '0.95rem', color }}>{label}</div>
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', letterSpacing: '0.04em' }}>{sub}</div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------
// Used as the route for /food.
// Renders the food tracker: today's log, meal suggestions, history, and the add/edit food forms.
const FoodPage: React.FC = () => {
  const [history, setHistory]     = useState<HistoryRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const [search,   setSearch]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [sort,     setSort]     = useState<'latest' | 'oldest'>('latest');
  const [page,     setPage]     = useState(1);

  // Detail modal
  const [detailDate,    setDetailDate]    = useState<string | null>(null);
  const [detail,        setDetail]        = useState<DayDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedCats,  setExpandedCats]  = useState<Record<string, boolean>>({
    Breakfast: true, Lunch: false, Dinner: false, Snacks: false,
  });

  // Add food modal
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    food_name: '',
    calories:  '',
    protein:   '',
    carbs:     '',
    fats:      '',
    fiber:     '',
    category:  'Breakfast',
    date:      new Date().toISOString().split('T')[0],
  });
  const [addError,   setAddError]   = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // Edit food modal
  const [editFood,     setEditFood]     = useState<FoodEntry | null>(null);
  const [editForm,     setEditForm]     = useState({ food_name: '', calories: '', protein: '', carbs: '', fats: '', fiber: '', category: '', date: '' });
  const [editError,    setEditError]    = useState<string | null>(null);
  const [editLoading,  setEditLoading]  = useState(false);

  // Delete food
  const [deleteId,      setDeleteId]      = useState<string | number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ------------------------------------------------------------------
  // Used when the Food page first loads.
  // Fetches the user's full food logging history (daily totals).
  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await foodAPI.getHistory();
      setHistory(res.data?.history || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load food history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Add food handler
  // Used when the user submits the "add food" form.
  // Validates and saves the new food entry, then refreshes the history/detail view.
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.food_name.trim())                    { setAddError('Food name is required.');        return; }
    if (!form.calories || isNaN(Number(form.calories))) { setAddError('Enter a valid calorie amount.'); return; }
    if (!form.protein  || isNaN(Number(form.protein)))  { setAddError('Enter a valid protein amount.'); return; }
    setAddLoading(true);
    setAddError(null);
    try {
      await foodAPI.addFood({
        food_name: form.food_name.trim(),
        calories:  parseFloat(form.calories),
        protein:   parseFloat(form.protein),
        carbs:     parseFloat(form.carbs) || 0,
        fats:      parseFloat(form.fats) || 0,
        fiber:     parseFloat(form.fiber) || 0,
        category:  form.category,
        date:      form.date,
      });
      setShowForm(false);
      setForm({ food_name: '', calories: '', protein: '', carbs: '', fats: '', fiber: '', category: 'Breakfast', date: new Date().toISOString().split('T')[0] });
      await loadHistory();
      // If the add was triggered from a breakdown view, refresh detail
      if (detailDate) await openDetail(detailDate);
    } catch (err: any) {
      setAddError(err?.response?.data?.message || err?.message || 'Failed to add food.');
    } finally {
      setAddLoading(false);
    }
  };

  // Used when the user clicks a day in the food history to see its breakdown.
  // Fetches all foods logged on that date along with the day's summary.
  const openDetail = async (date: string) => {
    setDetailDate(date);
    setDetail(null);
    setDetailLoading(true);
    setExpandedCats({ Breakfast: true, Lunch: false, Dinner: false, Snacks: false });
    try {
      const isoDate = formatDate(date)?.iso;
      if (!isoDate) { setDetail(null); return; }
      const res = await foodAPI.getByDate(isoDate);
      setDetail({ foods: res.data?.foods || [], summary: res.data?.summary || { total_calories: 0, total_protein: 0, calorie_target: 0, protein_target: 0, remaining_calories: 0, remaining_protein: 0 } });
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Used when the user closes the day-detail modal.
  // Clears the currently open day's detail state.
  const closeDetail    = () => { setDetailDate(null); setDetail(null); };
  // Used when the user clicks a meal category header in the day-detail modal.
  // Expands or collapses that category's food list.
  const toggleCategory = (cat: string) => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));

  // Used when the user clicks "Edit" on a logged food entry.
  // Pre-fills the edit form with that food entry's current values.
  const openEdit = (food: FoodEntry) => {
    setEditFood(food);
    setEditForm({
      food_name: food.food_name,
      calories:  String(Math.round(food.calories)),
      protein:   String(Math.round(food.protein)),
      carbs:     String(food.carbs ?? ''),
      fats:      String(food.fats ?? ''),
      fiber:     String(food.fiber ?? ''),
      category:  food.category || food.meal_type || 'Breakfast',
      date:      food.date,
    });
    setEditError(null);
  };

  // Used when the user saves changes in the edit food modal.
  // Validates and sends the updated food fields to the backend.
  const handleEditSave = async () => {
    if (!editFood) return;
    if (!editForm.food_name.trim())                     { setEditError('Food name is required.'); return; }
    if (!editForm.calories || isNaN(Number(editForm.calories))) { setEditError('Enter a valid calorie amount.'); return; }
    if (!editForm.protein  || isNaN(Number(editForm.protein)))  { setEditError('Enter a valid protein amount.'); return; }
    setEditLoading(true);
    setEditError(null);
    try {
      await foodAPI.updateFood(editFood.id, {
        food_name: editForm.food_name.trim(),
        calories:  parseFloat(editForm.calories),
        protein:   parseFloat(editForm.protein),
        carbs:     parseFloat(editForm.carbs) || 0,
        fats:      parseFloat(editForm.fats) || 0,
        fiber:     parseFloat(editForm.fiber) || 0,
        category:  editForm.category,
        date:      editForm.date,
      });
      setEditFood(null);
      if (detailDate) openDetail(detailDate);
      await loadHistory();
    } catch (err: any) {
      setEditError(err?.response?.data?.message || err?.message || 'Failed to update.');
    } finally {
      setEditLoading(false);
    }
  };

  // Used when the user confirms deleting a logged food entry.
  // Deletes the food entry and refreshes the history/detail view.
  const handleDelete = async (id: string | number) => {
    setDeleteLoading(true);
    try {
      await foodAPI.deleteFood(id);
      setDeleteId(null);
      if (detailDate) await openDetail(detailDate);
      await loadHistory();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to delete.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Open add modal pre-filled with breakdown date
  // Used when the user clicks "Add food" from within a day's breakdown view.
  // Opens the add-food form pre-filled with that day's date.
  const openAddForDate = (isoDate: string) => {
    setAddError(null);
    setForm({ food_name: '', calories: '', protein: '', carbs: '', fats: '', fiber: '', category: 'Breakfast', date: isoDate });
    setShowForm(true);
  };
  // ------------------------------------------------------------------
  const sortedHistory = [...history].sort((a, b) => {
    // String compare: ISO YYYY-MM-DD sorts lexicographically, avoids UTC→local rollback (e.g. IST shifts Jun 8 → Jun 7)
    const da = a.date.slice(0, 10);
    const db = b.date.slice(0, 10);
    return sort === 'latest' ? db.localeCompare(da) : da.localeCompare(db);
  });

  const filteredHistory = sortedHistory.filter((row) => {
    if (search) {
      const d = formatDate(row.date), needle = search.toLowerCase();
      if (!d.full.toLowerCase().includes(needle) && !d.weekday.toLowerCase().includes(needle) && !row.date.includes(needle)) return false;
    }
    const iso = formatDate(row.date).iso;
    if (dateFrom && iso < dateFrom) return false;
    if (dateTo   && iso > dateTo)   return false;
    return true;
  });

  const totalPages      = Math.max(1, Math.ceil(filteredHistory.length / ITEMS_PER_PAGE));
  const currentPage     = Math.min(page, totalPages);
  const paginatedHistory = filteredHistory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const totalDays      = history.length;
  const avgCalories    = totalDays > 0 ? Math.round(history.reduce((s, r) => s + r.total_calories, 0) / totalDays) : 0;
  const avgProtein     = totalDays > 0 ? Math.round(history.reduce((s, r) => s + r.total_protein,  0) / totalDays) : 0;
  const highestProtein = totalDays > 0 ? Math.max(...history.map(r => r.total_protein)) : 0;

  // Used when rendering the pagination controls on the food history table.
  // Builds the list of page numbers to display, with "..." for skipped ranges.
  const getPageNumbers = () => {
    if (currentPage <= 4) return [1, 2, 3, 4, '...', totalPages];
    if (currentPage >= totalPages - 3) return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  // ------------------------------------------------------------------
  // Shared styles
  // ------------------------------------------------------------------
  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.75)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(0,0,0,0.09)',
    borderRadius: '14px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  };

  const inputStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid rgba(0,0,0,0.09)',
    borderRadius: '8px',
    color: '#0f172a',
    fontFamily: 'Nunito, sans-serif',
    fontSize: '0.9rem',
    padding: '0.6rem 0.9rem',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  // ------------------------------------------------------------------
  return (
    <div className="page-wrap">

      {/* ── Page header ── */}
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }} className="fade-in">
        <div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '3rem', letterSpacing: '0.06em', color: '#0f172a', lineHeight: 1 }}>
            Food History
          </h1>
          <p style={{ color: '#64748b', marginTop: '0.3rem', fontSize: '0.95rem' }}>
            Track your daily nutrition — calories, protein, and meal breakdowns.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => { setAddError(null); setForm({ food_name: '', calories: '', protein: '', carbs: '', fats: '', fiber: '', category: 'Breakfast', date: new Date().toISOString().split('T')[0] }); setShowForm(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', padding: '0.7rem 1.5rem', whiteSpace: 'nowrap' }}
        >
          <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>+</span> Add Food
        </button>
      </div>

      {/* ── Suggest a Meal panel ── */}
      <SuggestMealPanel onLogged={loadHistory} />

      {/* ── Stats strip ── */}
      {!loading && totalDays > 0 && (
        <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { icon: '📅', label: 'Days Tracked',     value: totalDays,                    unit: 'days',     color: '#0f172a', accent: '#16a34a' },
            { icon: '🔥', label: 'Avg. Calories',     value: avgCalories.toLocaleString(), unit: 'kcal/day', color: '#ea6c00', accent: '#ea6c00' },
            { icon: '💪', label: 'Avg. Protein',      value: avgProtein,                   unit: 'g/day',    color: '#1d4ed8', accent: '#1d4ed8' },
            { icon: '🏆', label: 'Best Protein Day',  value: highestProtein,               unit: 'g',        color: '#16a34a', accent: '#16a34a' },
          ].map((s) => (
            <div key={s.label} style={{ ...card, padding: '1.1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                <span style={{ fontSize: '1.2rem' }}>{s.icon}</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>{s.label}</span>
              </div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.2rem', lineHeight: 1, color: s.color }}>
                {s.value}
                <span style={{ fontSize: '0.8rem', fontWeight: 600, fontFamily: 'Nunito, sans-serif', color: s.accent, marginLeft: '0.3rem' }}>{s.unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="fade-in" style={{ ...card, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <input type="text" placeholder="🔍  Search by date or weekday…" value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ ...inputStyle, flex: '1 1 200px' }} />
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
          style={{ ...inputStyle, flex: '1 1 150px' }} />
        <span style={{ color: '#94a3b8', fontWeight: 700 }}>–</span>
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
          style={{ ...inputStyle, flex: '1 1 150px' }} />
        <select value={sort} onChange={e => { setSort(e.target.value as 'latest' | 'oldest'); setPage(1); }}
          style={{ ...inputStyle, flex: '1 1 160px', cursor: 'pointer' }}>
          <option value="latest">Latest First</option>
          <option value="oldest">Oldest First</option>
        </select>
        {(search || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setPage(1); }}
            style={{ background: 'transparent', border: '1px solid rgba(220,38,38,0.25)', borderRadius: '8px', padding: '0.5rem 0.8rem', cursor: 'pointer', color: '#dc2626', fontSize: '0.82rem', fontWeight: 600 }}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* ── History list ── */}
      <div className="fade-in" style={{ ...card, padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', letterSpacing: '0.04em', color: '#0f172a' }}>
            All Records
          </h2>
          {filteredHistory.length > 0 && (
            <span className="badge badge-green">{filteredHistory.length} {filteredHistory.length === 1 ? 'day' : 'days'}</span>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div className="spinner" />
            <p style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.9rem' }}>Loading history…</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p className="msg-error" style={{ marginBottom: '0.75rem' }}>{error}</p>
            <button className="btn-primary" onClick={loadHistory}>Retry</button>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🥗</div>
            <p>No records found. Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="fp-history-header">
              {['Date', 'Day', 'Calories', 'Protein', 'Items', ''].map(h => (
                <div key={h} style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>{h}</div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
              {paginatedHistory.map((row) => {
                const d = formatDate(row.date);
                return (
                  <div
                    key={row.date}
                    className="fp-history-row"
                    style={{ padding: '0.65rem 0.75rem', background: 'rgba(248,250,252,0.6)', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.05)', transition: 'background 0.15s, border-color 0.15s', cursor: 'default' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(22,163,74,0.04)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(22,163,74,0.2)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(248,250,252,0.6)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,0,0,0.05)'; }}
                  >
                    <div className="fp-date-cell" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', padding: '0.3rem 0.4rem', textAlign: 'center', width: 'fit-content' }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem', lineHeight: 1, color: '#16a34a' }}>{d.day}</div>
                      <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em' }}>{d.month} {d.year}</div>
                    </div>
                    <div className="fp-day-cell">
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>{d.weekday}</div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{d.full}</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', color: '#ea6c00', lineHeight: 1 }}>{row.total_calories.toLocaleString()}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>kcal</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', color: '#1d4ed8', lineHeight: 1 }}>{row.total_protein}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>g protein</div>
                    </div>
                    <div>
                      <span style={{ background: 'rgba(22,163,74,0.1)', color: '#15803d', borderRadius: '20px', padding: '0.2rem 0.6rem', fontSize: '0.82rem', fontWeight: 700 }}>{row.food_count}</span>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.1rem' }}>foods</div>
                    </div>
                    <button onClick={() => openDetail(row.date)} className="btn-primary fp-action-cell"
                      style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      👁 Details
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.12)', background: '#fff', color: currentPage === 1 ? '#c4c4c4' : '#475569', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 600 }}>‹</button>
                {getPageNumbers().map((p, idx) =>
                  p === '...' ? <span key={`ell-${idx}`} style={{ padding: '0.35rem 0.4rem', color: '#94a3b8' }}>…</span> : (
                    <button key={p} onClick={() => setPage(Number(p))}
                      style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.12)', background: currentPage === p ? '#16a34a' : '#fff', color: currentPage === p ? '#fff' : '#475569', cursor: 'pointer', fontWeight: 600 }}>{p}</button>
                  )
                )}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.12)', background: '#fff', color: currentPage === totalPages ? '#c4c4c4' : '#475569', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontWeight: 600 }}>›</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ============================================================ */}
      {/* DETAIL MODAL                                                  */}
      {/* ============================================================ */}
      {detailDate && (
        <div className="modal-overlay" onClick={closeDetail}>
          <div className="modal-box" style={{ maxWidth: '680px', maxHeight: '88vh', overflowY: 'auto', padding: '1.75rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', letterSpacing: '0.05em', margin: 0 }}>Daily Breakdown</h2>
                <p style={{ color: '#64748b', margin: '0.15rem 0 0', fontSize: '0.9rem' }}>{detailDate ? formatDate(detailDate).full : ''}</p>
              </div>
              <button onClick={closeDetail} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>✕ Close</button>
            </div>

            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>
            ) : detail ? (
              <>
                {/* Progress rings */}
                <div className="fp-ring-row">
                  <ProgressRing value={detail.summary?.total_calories ?? 0} max={detail.summary?.calorie_target ?? 0} color="#ea6c00"
                    label={`${(detail.summary?.total_calories ?? 0).toLocaleString()} kcal`} sub={`of ${(detail.summary?.calorie_target ?? 0).toLocaleString()} target`} />
                  <ProgressRing value={detail.summary?.total_protein ?? 0} max={detail.summary?.protein_target ?? 0} color="#1d4ed8"
                    label={`${detail.summary?.total_protein ?? 0}g protein`} sub={`of ${detail.summary?.protein_target ?? 0}g target`} />
                </div>

                {/* Summary 2×2 */}
                <div className="fp-summary-grid">
                  {[
                    { label: 'Calories Consumed', value: `${(detail.summary?.total_calories ?? 0).toLocaleString()} kcal`, icon: '🔥', color: '#ea6c00', bg: 'rgba(234,108,0,0.06)' },
                    { label: 'Protein Consumed',  value: `${detail.summary?.total_protein ?? 0}g`,                       icon: '💪', color: '#1d4ed8', bg: 'rgba(29,78,216,0.06)' },
                    { label: 'Calorie Target',    value: `${(detail.summary?.calorie_target ?? 0).toLocaleString()} kcal`, icon: '🎯', color: '#475569', bg: 'rgba(0,0,0,0.03)' },
                    { label: 'Remaining',         value: `${detail.summary?.remaining_calories ?? 0} kcal`,
                      icon: (detail.summary?.remaining_calories ?? 0) < 0 ? '⚠️' : '✅',
                      color: (detail.summary?.remaining_calories ?? 0) < 0 ? '#dc2626' : '#16a34a',
                      bg:    (detail.summary?.remaining_calories ?? 0) < 0 ? 'rgba(220,38,38,0.06)' : 'rgba(22,163,74,0.06)' },
                  ].map(s => (
                    <div key={s.label} style={{ background: s.bg, border: '1px solid rgba(0,0,0,0.07)', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94a3b8', marginBottom: '0.3rem' }}>
                        <span>{s.label}</span><span>{s.icon}</span>
                      </div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', color: s.color, lineHeight: 1 }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Meal categories */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {CATEGORIES.map(cat => {
                    const items   = detail.foods.filter(f => (f.category || '').toLowerCase() === cat.toLowerCase());
                    const catCals = Math.round(items.reduce((s, i) => s + i.calories, 0));
                    const catPro  = Math.round(items.reduce((s, i) => s + i.protein,  0));
                    const isOpen  = expandedCats[cat];
                    const cc      = CAT_COLORS[cat];
                    return (
                      <div key={cat} style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
                        <button onClick={() => toggleCategory(cat)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: isOpen ? cc.bg : 'rgba(248,250,252,0.8)', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                            <span style={{ fontSize: '1.1rem' }}>{CAT_ICONS[cat]}</span>
                            {cat}
                            {items.length > 0 && (
                              <span style={{ background: cc.bg, color: cc.text, borderRadius: '20px', padding: '0.1rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, marginLeft: '0.3rem' }}>
                                {items.length} item{items.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </span>
                          <span style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            {items.length > 0 && (
                              <span style={{ fontSize: '0.82rem' }}>
                                <span style={{ color: '#ea6c00', fontWeight: 700 }}>{catCals} kcal</span>
                                {' · '}
                                <span style={{ color: '#1d4ed8', fontWeight: 700 }}>{catPro}g</span>
                              </span>
                            )}
                            <span style={{ color: cc.dot, fontSize: '0.7rem' }}>{isOpen ? '▲' : '▼'}</span>
                          </span>
                        </button>
                        {isOpen && (
                          <div style={{ padding: '0.75rem 1rem', background: '#fff' }}>
                            {items.length === 0 ? (
                              <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '0.5rem 0' }}>No items logged for {cat.toLowerCase()}</p>
                            ) : (
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr>
                                      {['Food', 'Calories', 'Protein', ''].map(h => (
                                        <th key={h} style={{ textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94a3b8', paddingBottom: '0.4rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{h}</th>
                                      ))}
                                    </tr>
                                </thead>
                                  <tbody>
                                    {items.map(f => (
                                      <tr key={f.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                                        <td style={{ padding: '0.5rem 0', fontSize: '0.88rem', color: '#0f172a', fontWeight: 500 }}>{f.food_name}</td>
                                        <td style={{ color: '#ea6c00', fontWeight: 700, fontSize: '0.88rem' }}>{Math.round(f.calories)} kcal</td>
                                        <td style={{ color: '#1d4ed8', fontWeight: 700, fontSize: '0.88rem' }}>{Math.round(f.protein)}g</td>
                                        <td style={{ padding: '0.5rem 0', textAlign: 'right' }}>
                                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                            <button className="btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }} onClick={() => openEdit(f)}>✏️ Edit</button>
                                            <button
                                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: '6px', color: '#dc2626', cursor: 'pointer', fontWeight: 600, fontFamily: 'Nunito, sans-serif' }}
                                              onClick={() => setDeleteId(f.id)}
                                            >🗑️</button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  <tr>
                                    <td style={{ paddingTop: '0.5rem', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>Total</td>
                                    <td style={{ color: '#16a34a', fontWeight: 800, paddingTop: '0.5rem' }}>{catCals} kcal</td>
                                    <td style={{ color: '#1d4ed8', fontWeight: 800, paddingTop: '0.5rem' }}>{catPro}g</td>
                                    <td></td>
                                  </tr>
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
                  <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    onClick={() => {
                      const rows: (string | number)[][] = [
                        ['Category', 'Food', 'Calories (kcal)', 'Protein (g)'],
                        ...detail.foods.map(f => [f.category || '', f.food_name, Math.round(f.calories), Math.round(f.protein)]),
                        [], ['Total', '', detail.summary.total_calories, detail.summary.total_protein],
                        ['Target', '', detail.summary.calorie_target, '—'],
                        ['Remaining', '', detail.summary.remaining_calories, '—'],
                      ];
                      const csv  = rows.map(r => r.join(',')).join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url  = URL.createObjectURL(blob);
                      const a    = document.createElement('a');
                      a.href = url; a.download = `food-report-${detailDate ? formatDate(detailDate).iso : 'export'}.csv`; a.click();
                      URL.revokeObjectURL(url);
                    }}>⬇ Export CSV</button>
                  <button
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'linear-gradient(135deg,#16a34a,#15803d)' }}
                    onClick={() => {
                      const isoDate = detailDate ? formatDate(detailDate).iso : new Date().toISOString().split('T')[0];
                      openAddForDate(isoDate);
                    }}
                  >
                    <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>+</span> Add Food
                  </button>
                  <button className="btn-secondary" onClick={closeDetail} style={{ flex: 1 }}>Close</button>
                </div>
              </>
            ) : (
              <p className="msg-error" style={{ textAlign: 'center' }}>Failed to load details. Please try again.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Add Food Modal ── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2>Add Food</h2>
            {addError && <div className="msg-error" style={{ marginBottom: '1rem' }}>{addError}</div>}
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label">Food Name</label>
                <FoodAutocompleteInput
                  value={form.food_name}
                  onNameChange={name => setForm(p => ({ ...p, food_name: name }))}
                  onAutofill={values => setForm(p => ({
                    ...p,
                    calories: String(values.calories),
                    protein:  String(values.protein),
                    carbs:    String(values.carbs),
                    fats:     String(values.fats),
                  }))}
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
              <div>
                <label className="form-label">Date</label>
                <input
                  className="input-field"
                  type="date"
                  value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div className="grid-2">
                <div>
                  <label className="form-label">Calories (kcal)</label>
                  <input
                    className="input-field"
                    type="number"
                    placeholder="250"
                    min="0"
                    step="any"
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
                    step="any"
                    value={form.protein}
                    onChange={e => setForm(p => ({ ...p, protein: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid-2">
                <div>
                  <label className="form-label">Carbs (g)</label>
                  <input
                    className="input-field"
                    type="number"
                    placeholder="30"
                    min="0"
                    step="any"
                    value={form.carbs}
                    onChange={e => setForm(p => ({ ...p, carbs: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">Fats (g)</label>
                  <input
                    className="input-field"
                    type="number"
                    placeholder="10"
                    min="0"
                    step="any"
                    value={form.fats}
                    onChange={e => setForm(p => ({ ...p, fats: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Fiber (g)</label>
                <input
                  className="input-field"
                  type="number"
                  placeholder="3"
                  min="0"
                  value={form.fiber}
                  onChange={e => setForm(p => ({ ...p, fiber: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={addLoading}>
                  {addLoading ? 'Adding…' : 'Add Food'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Food Modal ── */}
      {editFood && (
        <div className="modal-overlay" onClick={() => setEditFood(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Food</h2>
            {editError && <div className="msg-error" style={{ marginBottom: '1rem' }}>{editError}</div>}
            <form onSubmit={(e) => { e.preventDefault(); handleEditSave(); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label">Food Name</label>
                <input
                  className="input-field"
                  placeholder="e.g. Boiled Eggs"
                  value={editForm.food_name}
                  onChange={e => setEditForm(p => ({ ...p, food_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Category</label>
                <select
                  className="input-field"
                  value={editForm.category}
                  onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{CAT_ICONS[c]} {c}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Date</label>
                <input
                  className="input-field"
                  type="date"
                  value={editForm.date}
                  onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div className="grid-2">
                <div>
                  <label className="form-label">Calories (kcal)</label>
                  <input className="input-field" type="number" placeholder="250" min="0"
                    value={editForm.calories}
                    onChange={e => setEditForm(p => ({ ...p, calories: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Protein (g)</label>
                  <input className="input-field" type="number" placeholder="20" min="0"
                    value={editForm.protein}
                    onChange={e => setEditForm(p => ({ ...p, protein: e.target.value }))} />
                </div>
              </div>
              <div className="grid-2">
                <div>
                  <label className="form-label">Carbs (g)</label>
                  <input className="input-field" type="number" placeholder="30" min="0"
                    value={editForm.carbs}
                    onChange={e => setEditForm(p => ({ ...p, carbs: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Fats (g)</label>
                  <input className="input-field" type="number" placeholder="10" min="0"
                    value={editForm.fats}
                    onChange={e => setEditForm(p => ({ ...p, fats: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="form-label">Fiber (g)</label>
                <input className="input-field" type="number" placeholder="3" min="0"
                  value={editForm.fiber}
                  onChange={e => setEditForm(p => ({ ...p, fiber: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setEditFood(null)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={editLoading}>
                  {editLoading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteId !== null && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-box" style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🗑️</div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>Delete Food Entry?</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              This will permanently remove this food entry from your log. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setDeleteId(null)}>Cancel</button>
              <button
                style={{ flex: 1, padding: '0.65rem 1rem', background: '#dc2626', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'Nunito, sans-serif', cursor: deleteLoading ? 'not-allowed' : 'pointer', opacity: deleteLoading ? 0.7 : 1 }}
                disabled={deleteLoading}
                onClick={() => handleDelete(deleteId)}
              >
                {deleteLoading ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default FoodPage;