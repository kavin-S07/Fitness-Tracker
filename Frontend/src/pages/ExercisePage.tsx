// src/pages/ExercisePage.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { exerciseAPI } from '../services/api';
import { Exercise, WorkoutLog } from '../types';
import "./exercise-page-styles.css";

const MUSCLE_ICONS: Record<string, string> = {
  Chest: '💪', Back: '🔙', Legs: '🦵', Shoulders: '🏋️', Arms: '💪',
  Biceps: '💪', Triceps: '💪', Core: '🔥', Cardio: '🏃', Full: '⚡',
  Abs: '💪', 'Shoulder': '🏋️'
};

const toCDNUrl = (url: string): string => {
  if (!url) return '';
  const ucMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (ucMatch) return `https://lh3.googleusercontent.com/d/${ucMatch[1]}`;
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
  return url;
};

interface SetEntry { set_number: number; reps: string; weight: string; }

interface DetailedWorkoutLog extends WorkoutLog {
  exercise_name: string;
  exercise_type: string;
  target_muscle?: string;
}

interface WorkoutDay {
  date: string;
  muscle_groups: string[];
  total_volume: number;
  total_sets: number;
  exercises_count: number;
  logs: DetailedWorkoutLog[];
  duration_min?: number;
}

const ITEMS_PER_PAGE = 8;

const ExercisePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'history' | 'library'>('history');

  // Library state
  const [categories, setCategories] = useState<string[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [loadingExercises, setLoadingExercises] = useState(true);

  // Logging modal state
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [sets, setSets] = useState<SetEntry[]>([{ set_number: 1, reps: '', weight: '' }]);
  const [workoutDate, setWorkoutDate] = useState(new Date().toISOString().split('T')[0]);
  const [logSuccess, setLogSuccess] = useState('');
  const [logError, setLogError] = useState('');

  // Workout history state
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<WorkoutDay | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMuscle, setFilterMuscle] = useState<string>('All Muscles');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  // Stats
  const [stats, setStats] = useState({
    totalDays: 0,
    totalSets: 0,
    totalExercises: 0,
    totalVolume: 0
  });

  const loadCategories = useCallback(async () => {
    try {
      const res = await exerciseAPI.getCategories();
      const cats: string[] = res.data.categories || [];
      setCategories(cats);
      if (cats.length > 0) setActiveCategory(cats[0]);
    } catch { }
  }, []);

  const loadExercises = useCallback(async (type: string) => {
    setLoadingExercises(true);
    try {
      const res = await exerciseAPI.getList(type);
      const raw = res.data.exercises;
      const list: Exercise[] = Array.isArray(raw) ? raw : Object.values(raw).flat() as Exercise[];
      setExercises(list);
    } catch { }
    finally { setLoadingExercises(false); }
  }, []);

  const loadWorkoutHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await exerciseAPI.getAllWorkouts(90);
      const logs: DetailedWorkoutLog[] = res.data.workouts || [];

      const groupedByDate: Map<string, DetailedWorkoutLog[]> = new Map();
      logs.forEach(log => {
        const date = log.workout_date;
        if (!groupedByDate.has(date)) groupedByDate.set(date, []);
        groupedByDate.get(date)!.push(log);
      });

      const days: WorkoutDay[] = [];
      let totalSetsAll = 0;
      let totalVolumeAll = 0;
      const uniqueExercisesAll = new Set<string>();

      for (const [date, dayLogs] of groupedByDate.entries()) {
        let dayVolume = 0;
        let daySets = 0;
        const muscleGroupsSet = new Set<string>();
        const exercisesSet = new Set<string>();

        dayLogs.forEach(log => {
          const volume = log.weight * log.reps;
          dayVolume += volume;
          daySets += log.sets;
          muscleGroupsSet.add(log.exercise_type);
          exercisesSet.add(log.exercise_name);
          uniqueExercisesAll.add(log.exercise_name);
          totalVolumeAll += volume;
          totalSetsAll += log.sets;
        });

        days.push({
          date,
          muscle_groups: Array.from(muscleGroupsSet),
          total_volume: dayVolume,
          total_sets: daySets,
          exercises_count: exercisesSet.size,
          logs: dayLogs,
          duration_min: Math.round(daySets * 1.8)
        });
      }

      setStats({
        totalDays: days.length,
        totalSets: totalSetsAll,
        totalExercises: uniqueExercisesAll.size,
        totalVolume: totalVolumeAll
      });

      days.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setWorkoutDays(days);

      // Auto-select first day
      if (days.length > 0) setSelectedDay(days[0]);
    } catch (err) {
      console.error('Failed to load workout history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
    loadWorkoutHistory();
  }, [loadCategories, loadWorkoutHistory]);

  useEffect(() => {
    if (activeCategory) loadExercises(activeCategory);
  }, [activeCategory, loadExercises]);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterMuscle, sortOrder]);

  const filteredAndSortedDays = useMemo(() => {
    let filtered = [...workoutDays];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(day =>
        day.muscle_groups.some(mg => mg.toLowerCase().includes(query)) ||
        day.logs.some(log => log.exercise_name.toLowerCase().includes(query))
      );
    }
    if (filterMuscle !== 'All Muscles') {
      filtered = filtered.filter(day => day.muscle_groups.includes(filterMuscle));
    }
    filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
    return filtered;
  }, [workoutDays, searchQuery, filterMuscle, sortOrder]);

  const totalPages = Math.ceil(filteredAndSortedDays.length / ITEMS_PER_PAGE);
  const paginatedDays = filteredAndSortedDays.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Build page numbers: always show first, last, current ±1, with ellipsis
  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    const range = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]
      .filter(p => p >= 1 && p <= totalPages));
    const sorted = Array.from(range).sort((a, b) => a - b);
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) pages.push('...');
      pages.push(p);
    });
    return pages;
  };

  const handleLogWorkout = async () => {
    if (!selectedExercise) return;
    setLogError('');
    const invalid = sets.some(s => !s.reps || !s.weight || Number(s.reps) <= 0);
    if (invalid) return setLogError('Fill reps & weight for all sets');
    try {
      await exerciseAPI.addWorkout({
        exercise_id: selectedExercise.id,
        sets: sets.map(s => ({ set_number: s.set_number, reps: Number(s.reps), weight: Number(s.weight) })),
        workout_date: workoutDate,
      });
      setLogSuccess(`✅ ${selectedExercise.exercise_name} logged!`);
      setSelectedExercise(null);
      setSets([{ set_number: 1, reps: '', weight: '' }]);
      loadWorkoutHistory();
      setTimeout(() => setLogSuccess(''), 4000);
    } catch (err: any) {
      setLogError(err?.response?.data?.message || 'Failed to log workout');
    }
  };

  const addSet = () => setSets(p => [...p, { set_number: p.length + 1, reps: '', weight: '' }]);
  const removeSet = (i: number) =>
    setSets(p => p.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, set_number: idx + 1 })));
  const updateSet = (i: number, field: 'reps' | 'weight', val: string) =>
    setSets(p => p.map((s, idx) => idx === i ? { ...s, [field]: val } : s));

  const getDifficultyColor = (d: string) =>
    d?.toLowerCase() === 'beginner' ? 'badge-green' :
    d?.toLowerCase() === 'intermediate' ? 'badge-orange' : 'badge-red';

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const getWorkoutTypeName = (muscleGroups: string[]) => {
    if (muscleGroups.length === 0) return 'Workout';
    if (muscleGroups.length === 1) return `${muscleGroups[0]} Day`;
    if (muscleGroups.length === 2) return `${muscleGroups[0]} + ${muscleGroups[1]} Day`;
    return `${muscleGroups.slice(0, 2).join(' + ')} +${muscleGroups.length - 2} Day`;
  };

  const getIconColor = (index: number) => {
    const colors = ['#16a34a', '#ea580c', '#7c3aed', '#f59e0b', '#dc2626'];
    return colors[index % colors.length];
  };
  const getIconBg = (index: number) => {
    const bgs = ['#f0fdf4', '#fff7ed', '#faf5ff', '#fffbeb', '#fef2f2'];
    return bgs[index % bgs.length];
  };

  // Group logs by exercise name for the details panel
  const groupedExercises = useMemo(() => {
    if (!selectedDay) return [];
    return selectedDay.logs.reduce((acc, log) => {
      const existing = acc.find(g => g.exercise_name === log.exercise_name);
      if (existing) {
        existing.logs.push(log);
      } else {
        acc.push({
          exercise_name: log.exercise_name,
          exercise_type: log.exercise_type,
          target_muscle: log.target_muscle,
          logs: [log]
        });
      }
      return acc;
    }, [] as { exercise_name: string; exercise_type: string; target_muscle?: string; logs: DetailedWorkoutLog[] }[]);
  }, [selectedDay]);

  return (
    <div className="page-wrap">
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }} className="fade-in">
        <h1 className="section-title">🏋️ Workout History</h1>
        <p className="section-subtitle">Track your progress, view previous workouts, and analyze your training performance.</p>
      </div>

      {logSuccess && <div className="msg-success" style={{ marginBottom: '1rem' }}>{logSuccess}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
        {(['history', 'library'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 500,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--green)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--green)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {tab === 'history' ? '📊 Workout History' : '📚 Exercise Library'}
          </button>
        ))}
      </div>

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <>
          {/* Stat cards */}
          <div className="ep-stats-row">
            {[
              { label: 'Total Days', value: stats.totalDays, sub: 'Workouts completed', icon: '📅', iconColor: '#16a34a', iconBg: '#f0fdf4' },
              { label: 'Total Sets', value: stats.totalSets.toLocaleString(), sub: 'All time sets', icon: '📚', iconColor: '#1d4ed8', iconBg: '#eff6ff' },
              { label: 'Exercises', value: stats.totalExercises, sub: 'Different exercises', icon: '🏋️', iconColor: '#7c3aed', iconBg: '#faf5ff' },
              { label: 'Total Volume', value: `${stats.totalVolume.toLocaleString()} kg`, sub: 'Total weight lifted', icon: '🔥', iconColor: '#ea580c', iconBg: '#fff7ed' },
            ].map((s, i) => (
              <div key={i} className="ep-stat-card glass">
                <div className="ep-stat-icon" style={{ background: s.iconBg }}>
                  <span style={{ fontSize: '1.25rem' }}>{s.icon}</span>
                </div>
                <div>
                  <div className="ep-stat-label">{s.label}</div>
                  <div className="ep-stat-value" style={{ color: s.iconColor }}>{s.value}</div>
                  <div className="ep-stat-sub">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {historyLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
              <div className="spinner" />
            </div>
          ) : (
            <>
              {/* ── TOP: Full-width Filter Bar ── */}
              <div className="glass ep-filter-bar">
                <div className="ep-filter-bar-section">
                  <span className="ep-filter-bar-label">Filter by muscles</span>
                  <div className="ep-filter-bar-chips">
                    {(['All Muscles', ...categories]).map(cat => (
                      <button
                        key={cat}
                        className={`ep-filter-chip${filterMuscle === cat ? ' ep-filter-chip--active' : ''}`}
                        onClick={() => setFilterMuscle(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ep-filter-bar-divider" />
                <div className="ep-filter-bar-section">
                  <span className="ep-filter-bar-label">Sort by</span>
                  <div className="ep-filter-bar-chips">
                    {(['newest', 'oldest'] as const).map(o => (
                      <button
                        key={o}
                        className={`ep-filter-chip${sortOrder === o ? ' ep-filter-chip--active' : ''}`}
                        onClick={() => setSortOrder(o)}
                      >
                        {o === 'newest' ? '📅 Latest First' : '🕐 Oldest First'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="ep-panels">
                {/* ── LEFT: Workout list ── */}
                <div className="glass ep-list-panel">
                  <div className="ep-list-head">
                    <span className="ep-panel-title">Workout History</span>
                    <div className="ep-search-box">
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>🔍</span>
                      <input
                        type="text"
                        placeholder="Search workouts..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="ep-search-input"
                      />
                    </div>
                  </div>

                  {paginatedDays.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <p>No workouts found.</p>
                      <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => setActiveTab('library')}>
                        Browse Exercises
                      </button>
                    </div>
                  ) : (
                    paginatedDays.map((day, idx) => {
                      const globalIdx = (currentPage - 1) * ITEMS_PER_PAGE + idx;
                      const isActive = selectedDay?.date === day.date;
                      return (
                        <div
                          key={day.date}
                          className={`ep-wo-row${isActive ? ' ep-wo-row--active' : ''}`}
                          onClick={() => setSelectedDay(day)}
                        >
                          <div className="ep-wo-icon" style={{ background: getIconBg(globalIdx) }}>
                            <span style={{ fontSize: '1rem' }}>📅</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="ep-wo-title">{getWorkoutTypeName(day.muscle_groups)}</div>
                            <div className="ep-wo-date">{formatDate(day.date)}</div>
                            <div className="ep-wo-chips">
                              <span className="ep-chip">🏃 {day.exercises_count} Exercises</span>
                              <span className="ep-chip">📊 {day.total_sets} Sets</span>
                              {day.duration_min && <span className="ep-chip">⏱️ {day.duration_min} mins</span>}
                              <span className="ep-chip">🏋️ {day.total_volume.toLocaleString()} kg</span>
                            </div>
                          </div>
                          <button className="ep-view-btn" onClick={e => { e.stopPropagation(); setSelectedDay(day); }}>
                            View Details ›
                          </button>
                        </div>
                      );
                    })
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="ep-pager">
                      <button
                        className="ep-pg-btn"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        ‹ Previous
                      </button>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {getPageNumbers().map((p, i) =>
                          p === '...' ? (
                            <span key={`dots-${i}`} className="ep-pg-dots">...</span>
                          ) : (
                            <button
                              key={p}
                              className={`ep-pg-num${currentPage === p ? ' ep-pg-num--active' : ''}`}
                              onClick={() => setCurrentPage(p as number)}
                            >
                              {p}
                            </button>
                          )
                        )}
                      </div>
                      <button
                        className="ep-pg-btn"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next ›
                      </button>
                    </div>
                  )}
                </div>

                {/* ── RIGHT: Detail panel ── */}
              <div className="glass ep-detail-panel">
                {!selectedDay ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p>Select a workout to view details</p>
                  </div>
                ) : (
                  <>
                    <div className="ep-det-head">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="ep-panel-title">Workout Details</span>
                        <button className="ep-close-btn" onClick={() => setSelectedDay(null)}>✕</button>
                      </div>
                      <div className="ep-det-date">📅 {formatDate(selectedDay.date)}</div>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{getWorkoutTypeName(selectedDay.muscle_groups)}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Workout type</div>
                        </div>
                        <div className="ep-det-kpis">
                          <div className="ep-kpi">
                            <div className="ep-kpi-val">⏱️ {selectedDay.duration_min} mins</div>
                            <div className="ep-kpi-label">Duration</div>
                          </div>
                          <div className="ep-kpi">
                            <div className="ep-kpi-val">📊 {selectedDay.total_sets} Sets</div>
                            <div className="ep-kpi-label">Total sets</div>
                          </div>
                          <div className="ep-kpi">
                            <div className="ep-kpi-val">🏋️ {selectedDay.total_volume.toLocaleString()} kg</div>
                            <div className="ep-kpi-label">Total volume</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="ep-det-exercises">
                      {groupedExercises.map((group, idx) => (
                        <div key={idx} className="ep-ex-block">
                          <div className="ep-ex-header">
                            <div className="ep-ex-name">{group.exercise_name}</div>
                            <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                              {group.exercise_type}
                            </span>
                          </div>
                          <div style={{ overflowX: 'auto' }}>
                            <table className="ep-set-table">
                              <thead>
                                <tr>
                                  <th>Set</th>
                                  <th>Reps</th>
                                  <th>Weight (kg)</th>
                                  <th>Volume (kg)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.logs.map((log, setIdx) => {
                                  const volume = log.weight * log.reps;
                                  return (
                                    <tr key={setIdx}>
                                      <td>{setIdx + 1}</td>
                                      <td>{log.reps}</td>
                                      <td>{log.weight}</td>
                                      <td style={{ fontWeight: 600 }}>{volume.toLocaleString()}</td>
                                    </tr>
                                  );
                                })}
                                <tr className="ep-total-row">
                                  <td colSpan={3} style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                    Total volume
                                  </td>
                                  <td style={{ color: 'var(--green)', fontWeight: 700 }}>
                                    {group.logs.reduce((s, l) => s + l.weight * l.reps, 0).toLocaleString()} kg
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="ep-det-footer">
                      <div className="ep-det-foot-stat">
                        <div className="ep-det-foot-val">{selectedDay.exercises_count}</div>
                        <div className="ep-det-foot-label">Total exercises</div>
                      </div>
                      <div className="ep-det-foot-stat">
                        <div className="ep-det-foot-val">{selectedDay.total_sets}</div>
                        <div className="ep-det-foot-label">Total sets</div>
                      </div>
                      <div className="ep-det-foot-stat">
                        <div className="ep-det-foot-val">{selectedDay.total_volume.toLocaleString()} kg</div>
                        <div className="ep-det-foot-label">Total volume</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            </>          )}

          {/* FAB */}
          <button
            className="fab"
            onClick={() => setActiveTab('library')}
            style={{
              position: 'fixed', bottom: '2rem', right: '2rem',
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'var(--green)', border: 'none', color: 'white',
              fontSize: '1.5rem', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform 0.2s', zIndex: 100
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            +
          </button>
        </>
      )}

      {/* ── LIBRARY TAB ── */}
      {activeTab === 'library' && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }} className="fade-in-delay-1">
            {categories.map(cat => (
              <button key={cat} className={`tag ${activeCategory === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat)}>
                {MUSCLE_ICONS[cat] || '🏃'} {cat}
              </button>
            ))}
          </div>

          {loadingExercises ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}><div className="spinner" /></div>
          ) : (
            <div className="grid-3 fade-in-delay-2">
              {exercises.map(ex => (
                <div
                  key={ex.id}
                  className="exercise-card"
                  onClick={() => { setSelectedExercise(ex); setSets([{ set_number: 1, reps: '', weight: '' }]); setLogError(''); }}
                >
                  <div className="card-img" style={{ height: 180, background: '#f8f8f8', borderRadius: '8px 8px 0 0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {ex.image_url ? (
                      <img
                        src={toCDNUrl(ex.image_url)}
                        alt={ex.exercise_name}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '0.5rem' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <span style={{ fontSize: '3rem' }}>{MUSCLE_ICONS[ex.exercise_type] || '💪'}</span>
                    )}
                  </div>
                  <div className="card-body">
                    <div className="card-name">{ex.exercise_name}</div>
                    <div className="card-meta">
                      <span className={`badge ${getDifficultyColor(ex.difficulty)}`}>{ex.difficulty}</span>
                      {ex.equipment && <span className="badge badge-blue">{ex.equipment}</span>}
                    </div>
                    {ex.target_muscle && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        🎯 {ex.target_muscle}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {exercises.length === 0 && (
                <p style={{ color: 'var(--text-muted)', gridColumn: '1/-1', textAlign: 'center', paddingTop: '2rem' }}>
                  No exercises found for this category.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* ── LOG WORKOUT MODAL ── */}
      {selectedExercise && (
        <div className="modal-overlay" onClick={() => setSelectedExercise(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2>Log: {selectedExercise.exercise_name}</h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <span className="badge badge-green">{selectedExercise.exercise_type}</span>
              <span className={`badge ${getDifficultyColor(selectedExercise.difficulty)}`}>{selectedExercise.difficulty}</span>
              {selectedExercise.equipment && <span className="badge badge-blue">{selectedExercise.equipment}</span>}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Workout Date</label>
              <input type="date" className="input-field" value={workoutDate} onChange={e => setWorkoutDate(e.target.value)} style={{ maxWidth: '200px' }} />
            </div>
            {logError && <div className="msg-error" style={{ marginBottom: '1rem' }}>{logError}</div>}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span style={{ width: 48 }}>Set</span>
                <span style={{ flex: 1 }}>Reps</span>
                <span style={{ flex: 1 }}>Weight (kg)</span>
                <span style={{ width: 36 }}></span>
              </div>
              {sets.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ width: 48, fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--green)', fontWeight: 700 }}>
                    #{s.set_number}
                  </span>
                  <input className="input-field" type="number" placeholder="12" style={{ flex: 1 }}
                    value={s.reps} onChange={e => updateSet(i, 'reps', e.target.value)} min="1" />
                  <input className="input-field" type="number" placeholder="20" style={{ flex: 1 }}
                    value={s.weight} onChange={e => updateSet(i, 'weight', e.target.value)} min="0" step="0.5" />
                  <button className="btn-danger" onClick={() => sets.length > 1 && removeSet(i)} style={{ width: 32, padding: '0.4rem' }}>✕</button>
                </div>
              ))}
              <button className="btn-secondary" onClick={addSet} style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                + Add Set
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setSelectedExercise(null)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={handleLogWorkout}>💪 Log Workout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExercisePage;