// ============================================================
// src/pages/FoodDatabasePage.tsx
//
// Browse / search / sort the full food_nutrition_reference table.
// Pure reference tool — doesn't touch food logging in any way.
// ============================================================
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { foodAPI } from '../services/api';
import { FoodListResult, FoodReferenceDetail, FoodSortBy, FoodSortDir } from '../types';

const PAGE_SIZE = 20;

const SORT_COLUMNS: { key: FoodSortBy; label: string }[] = [
  { key: 'food_name',        label: 'Name' },
  { key: 'calories_kcal',    label: 'Calories' },
  { key: 'protein_g',        label: 'Protein' },
  { key: 'carbohydrates_g',  label: 'Carbs' },
  { key: 'fat_g',            label: 'Fat' },
];

// Micronutrient / vitamin field groupings for the detail view.
const MICRONUTRIENT_FIELDS: { key: keyof FoodReferenceDetail; label: string; unit: string }[] = [
  { key: 'sodium_mg',     label: 'Sodium',     unit: 'mg' },
  { key: 'potassium_mg',  label: 'Potassium',  unit: 'mg' },
  { key: 'calcium_mg',    label: 'Calcium',    unit: 'mg' },
  { key: 'iron_mg',       label: 'Iron',       unit: 'mg' },
  { key: 'magnesium_mg',  label: 'Magnesium',  unit: 'mg' },
  { key: 'phosphorus_mg', label: 'Phosphorus', unit: 'mg' },
  { key: 'zinc_mg',       label: 'Zinc',       unit: 'mg' },
];

const VITAMIN_FIELDS: { key: keyof FoodReferenceDetail; label: string; unit: string }[] = [
  { key: 'vitamin_a_ug',   label: 'Vitamin A',   unit: 'µg' },
  { key: 'vitamin_b1_mg',  label: 'Vitamin B1',  unit: 'mg' },
  { key: 'vitamin_b2_mg',  label: 'Vitamin B2',  unit: 'mg' },
  { key: 'vitamin_b3_mg',  label: 'Vitamin B3',  unit: 'mg' },
  { key: 'vitamin_b5_mg',  label: 'Vitamin B5',  unit: 'mg' },
  { key: 'vitamin_b6_mg',  label: 'Vitamin B6',  unit: 'mg' },
  { key: 'vitamin_b9_ug',  label: 'Vitamin B9',  unit: 'µg' },
  { key: 'vitamin_b12_ug', label: 'Vitamin B12', unit: 'µg' },
  { key: 'vitamin_c_mg',   label: 'Vitamin C',   unit: 'mg' },
  { key: 'vitamin_d_ug',   label: 'Vitamin D',   unit: 'µg' },
  { key: 'vitamin_e_mg',   label: 'Vitamin E',   unit: 'mg' },
  { key: 'vitamin_k_ug',   label: 'Vitamin K',   unit: 'µg' },
];

const MACRO_FIELDS: { key: keyof FoodReferenceDetail; label: string; unit: string }[] = [
  { key: 'calories_kcal',    label: 'Calories',      unit: 'kcal' },
  { key: 'protein_g',        label: 'Protein',       unit: 'g' },
  { key: 'carbohydrates_g',  label: 'Carbohydrates', unit: 'g' },
  { key: 'fat_g',            label: 'Fat',           unit: 'g' },
  { key: 'fiber_g',          label: 'Fiber',         unit: 'g' },
  { key: 'sugar_g',          label: 'Sugar',         unit: 'g' },
  { key: 'saturated_fat_g',  label: 'Saturated Fat', unit: 'g' },
];

// Used throughout the food detail modal.
// Displays a dash for missing values instead of leaving them blank.
const fmt = (v: unknown) => (v === null || v === undefined ? '—' : String(v));

// Used as the route for /food-database.
// Renders the searchable/sortable browse table of the full food nutrition reference data.
const FoodDatabasePage: React.FC = () => {
  const [results, setResults]     = useState<FoodListResult[]>([]);
  const [total, setTotal]         = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');
  const [sortBy, setSortBy]   = useState<FoodSortBy>('food_name');
  const [sortDir, setSortDir] = useState<FoodSortDir>('asc');

  const [detailId, setDetailId]           = useState<number | null>(null);
  const [detail, setDetail]               = useState<FoodReferenceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError]     = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the search box → committed `search` state, resetting to page 1.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // Used when the page loads or the search/sort/page settings change.
  // Fetches the current page of foods from the reference database matching the filters.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await foodAPI.listReference({
        search: search || undefined,
        sortBy,
        sortDir,
        page,
        pageSize: PAGE_SIZE,
      });
      setResults(res.results);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      setError('Failed to load the food database. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [search, sortBy, sortDir, page]);

  useEffect(() => { load(); }, [load]);

  // Used when the user clicks a column header in the food table.
  // Switches sorting to that column, or flips the sort direction if already sorting by it.
  const toggleSort = (col: FoodSortBy) => {
    if (sortBy === col) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  };

  // Used when the user clicks a food row in the table.
  // Fetches the full nutrition detail for that food to show in the detail modal.
  const openDetail = async (id: number) => {
    setDetailId(id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await foodAPI.getReferenceById(id);
      setDetail(res.data);
    } catch (err) {
      setDetailError('Failed to load nutrition details for this food.');
    } finally {
      setDetailLoading(false);
    }
  };

  // Used when the user closes the food detail modal.
  // Clears the currently open food's detail state.
  const closeDetail = () => { setDetailId(null); setDetail(null); setDetailError(null); };

  // Used when rendering the pagination controls for the food database table.
  // Builds the list of page numbers to display, with "..." for skipped ranges.
  const getPageNumbers = () => {
    if (page >= totalPages - 3) return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '...', page - 1, page, page + 1, '...', totalPages];
  };

  // ------------------------------------------------------------------
  // Shared styles (matches FoodPage's glassmorphism look)
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

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '0.78rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#94a3b8',
    marginBottom: '0.6rem',
  };

  return (
    <div className="page-wrap">

      {/* ── Page header ── */}
      <div style={{ marginBottom: '2rem' }} className="fade-in">
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '3rem', letterSpacing: '0.06em', color: '#0f172a', lineHeight: 1 }}>
          Food Database
        </h1>
        <p style={{ color: '#64748b', marginTop: '0.3rem', fontSize: '0.95rem' }}>
          Browse the full nutrition reference table — search, sort, and inspect any food.
        </p>
      </div>

      {/* ── Search ── */}
      <div className="fade-in" style={{ ...card, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="🔍  Search foods (e.g. chicken, idli, rice)…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          style={{ ...inputStyle, flex: '1 1 260px' }}
        />
        {search && (
          <button
            onClick={() => setSearchInput('')}
            style={{ background: 'transparent', border: '1px solid rgba(220,38,38,0.25)', borderRadius: '8px', padding: '0.5rem 0.8rem', cursor: 'pointer', color: '#dc2626', fontSize: '0.82rem', fontWeight: 600 }}
          >
            ✕ Clear
          </button>
        )}
        <span className="badge badge-green">{total} {total === 1 ? 'food' : 'foods'}</span>
      </div>

      {/* ── Table ── */}
      <div className="fade-in" style={{ ...card, padding: '1.5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div className="spinner" />
            <p style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.9rem' }}>Loading foods…</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p className="msg-error" style={{ marginBottom: '0.75rem' }}>{error}</p>
            <button className="btn-primary" onClick={load}>Retry</button>
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🥗</div>
            <p>No foods match your search.</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead>
                  <tr>
                    {SORT_COLUMNS.map(col => {
                      const active = sortBy === col.key;
                      return (
                        <th
                          key={col.key}
                          onClick={() => toggleSort(col.key)}
                          style={{
                            textAlign: col.key === 'food_name' ? 'left' : 'right',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.07em',
                            color: active ? '#16a34a' : '#94a3b8',
                            paddingBottom: '0.6rem',
                            borderBottom: '1px solid rgba(0,0,0,0.06)',
                            cursor: 'pointer',
                            userSelect: 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {col.label}{active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                      );
                    })}
                    <th style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }} />
                  </tr>
                </thead>
                <tbody>
                  {results.map(food => (
                    <tr
                      key={food.id}
                      onClick={() => openDetail(food.id)}
                      style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(22,163,74,0.04)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '0.65rem 0.4rem 0.65rem 0' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{food.food_name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{food.serving_quantity}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.05rem', color: '#ea6c00' }}>{food.calories_kcal}</td>
                      <td style={{ textAlign: 'right', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.05rem', color: '#1d4ed8' }}>{food.protein_g}g</td>
                      <td style={{ textAlign: 'right', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.05rem', color: '#0f172a' }}>{food.carbohydrates_g}g</td>
                      <td style={{ textAlign: 'right', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.05rem', color: '#0f172a' }}>{food.fat_g}g</td>
                      <td style={{ textAlign: 'right', padding: '0.65rem 0 0.65rem 0.4rem', color: '#94a3b8' }}>›</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.12)', background: '#fff', color: page === 1 ? '#c4c4c4' : '#475569', cursor: page === 1 ? 'not-allowed' : 'pointer', fontWeight: 600 }}>‹</button>
                {getPageNumbers().map((p, idx) =>
                  p === '...' ? <span key={`ell-${idx}`} style={{ padding: '0.35rem 0.4rem', color: '#94a3b8' }}>…</span> : (
                    <button key={p} onClick={() => setPage(Number(p))}
                      style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.12)', background: page === p ? '#16a34a' : '#fff', color: page === p ? '#fff' : '#475569', cursor: 'pointer', fontWeight: 600 }}>{p}</button>
                  )
                )}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.12)', background: '#fff', color: page === totalPages ? '#c4c4c4' : '#475569', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontWeight: 600 }}>›</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ============================================================ */}
      {/* DETAIL MODAL                                                  */}
      {/* ============================================================ */}
      {detailId !== null && (
        <div className="modal-overlay" onClick={closeDetail}>
          <div className="modal-box" style={{ maxWidth: '640px', maxHeight: '88vh', overflowY: 'auto', padding: '1.75rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', letterSpacing: '0.05em', margin: 0 }}>
                  {detail ? detail.food_name : 'Loading…'}
                </h2>
                {detail && (
                  <p style={{ color: '#64748b', margin: '0.15rem 0 0', fontSize: '0.9rem' }}>{detail.serving_quantity}</p>
                )}
              </div>
              <button onClick={closeDetail} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>✕ Close</button>
            </div>

            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>
            ) : detailError ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p className="msg-error" style={{ marginBottom: '0.75rem' }}>{detailError}</p>
                <button className="btn-primary" onClick={() => openDetail(detailId)}>Retry</button>
              </div>
            ) : detail ? (
              <>
                {/* Macros */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={sectionTitleStyle}>Macros</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem' }}>
                    {MACRO_FIELDS.map(f => (
                      <div key={String(f.key)} style={{ background: 'rgba(248,250,252,0.8)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', padding: '0.6rem 0.8rem' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>{f.label}</div>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', color: '#0f172a' }}>
                          {fmt(detail[f.key])}<span style={{ fontSize: '0.7rem', fontFamily: 'Nunito, sans-serif', color: '#94a3b8', marginLeft: '0.2rem' }}>{f.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Micronutrients */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={sectionTitleStyle}>Micronutrients</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem' }}>
                    {MICRONUTRIENT_FIELDS.map(f => (
                      <div key={String(f.key)} style={{ background: 'rgba(248,250,252,0.8)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', padding: '0.6rem 0.8rem' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>{f.label}</div>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', color: '#0f172a' }}>
                          {fmt(detail[f.key])}<span style={{ fontSize: '0.7rem', fontFamily: 'Nunito, sans-serif', color: '#94a3b8', marginLeft: '0.2rem' }}>{f.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vitamins */}
                <div>
                  <div style={sectionTitleStyle}>Vitamins</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem' }}>
                    {VITAMIN_FIELDS.map(f => (
                      <div key={String(f.key)} style={{ background: 'rgba(248,250,252,0.8)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', padding: '0.6rem 0.8rem' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>{f.label}</div>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', color: '#0f172a' }}>
                          {fmt(detail[f.key])}<span style={{ fontSize: '0.7rem', fontFamily: 'Nunito, sans-serif', color: '#94a3b8', marginLeft: '0.2rem' }}>{f.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default FoodDatabasePage;
