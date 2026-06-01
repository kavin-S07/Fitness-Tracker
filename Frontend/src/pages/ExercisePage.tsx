// ============================================================
// src/pages/ExercisePage.tsx
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import { exerciseAPI } from '../services/api';
import { Exercise, WorkoutLog } from '../types';

const MUSCLE_ICONS: Record<string, string> = {
  Chest: '💪', Back: '🔙', Legs: '🦵', Shoulders: '🏋️', Arms: '💪',
  Biceps: '💪', Triceps: '💪', Core: '🔥', Cardio: '🏃', Full: '⚡',
};

// Convert any Google Drive URL format to lh3 CDN (works in <img> tags)
const toCDNUrl = (url: string): string => {
  if (!url) return '';

  // Format 1: https://drive.google.com/uc?export=view&id=FILE_ID
  const ucMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (ucMatch) return `https://lh3.googleusercontent.com/d/${ucMatch[1]}`;

  // Format 2: https://drive.google.com/file/d/FILE_ID/view
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;

  // Already lh3 or some other URL — return as-is
  return url;
};

interface SetEntry { set_number: number; reps: string; weight: string; }

const ExercisePage: React.FC = () => {
  const [categories, setCategories] = useState<string[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [todayWorkouts, setTodayWorkouts] = useState<WorkoutLog[]>([]);
  const [sets, setSets] = useState<SetEntry[]>([{ set_number: 1, reps: '', weight: '' }]);
  const [workoutDate, setWorkoutDate] = useState(new Date().toISOString().split('T')[0]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const loadCategories = useCallback(async () => {
    try {
      const res = await exerciseAPI.getCategories();
      const cats: string[] = res.data.categories || [];
      setCategories(cats);
      if (cats.length > 0) setActiveCategory(cats[0]);
    } catch { /* ignore */ }
  }, []);

  const loadExercises = useCallback(async (type: string) => {
    setLoading(true);
    try {
      const res = await exerciseAPI.getList(type);
      // When filtered by type, backend returns an array; otherwise a grouped object
      const raw = res.data.exercises;
      const list: Exercise[] = Array.isArray(raw) ? raw : Object.values(raw).flat() as Exercise[];
      setExercises(list);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const loadToday = useCallback(async () => {
    try {
      const res = await exerciseAPI.getTodayWorkout();
      setTodayWorkouts(res.data.workouts || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadCategories(); loadToday(); }, [loadCategories, loadToday]);
  useEffect(() => { if (activeCategory) loadExercises(activeCategory); }, [activeCategory, loadExercises]);

  const addSet = () => setSets(p => [...p, { set_number: p.length + 1, reps: '', weight: '' }]);
  const removeSet = (i: number) =>
    setSets(p => p.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, set_number: idx + 1 })));
  const updateSet = (i: number, field: 'reps' | 'weight', val: string) =>
    setSets(p => p.map((s, idx) => idx === i ? { ...s, [field]: val } : s));

  const handleLogWorkout = async () => {
    if (!selectedExercise) return;
    setError('');
    const invalid = sets.some(s => !s.reps || !s.weight || Number(s.reps) <= 0);
    if (invalid) return setError('Fill reps & weight for all sets');
    try {
      await exerciseAPI.addWorkout({
        exercise_id: selectedExercise.id,
        sets: sets.map(s => ({ set_number: s.set_number, reps: Number(s.reps), weight: Number(s.weight) })),
        workout_date: workoutDate,
      });
      setSuccess(`✅ ${selectedExercise.exercise_name} logged!`);
      setSelectedExercise(null);
      setSets([{ set_number: 1, reps: '', weight: '' }]);
      loadToday();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to log workout');
    }
  };

  const handleDeleteWorkout = async (id: number | string) => {
    try { await exerciseAPI.deleteWorkout(id); loadToday(); }
    catch { /* ignore */ }
  };

  const getDifficultyColor = (d: string) =>
    d?.toLowerCase() === 'beginner' ? 'badge-green' :
    d?.toLowerCase() === 'intermediate' ? 'badge-orange' : 'badge-red';

  // ── Image component with lh3 CDN + emoji fallback ──────────────────────
  const ExerciseImage: React.FC<{ exercise: Exercise }> = ({ exercise }) => {
    const [imgSrc, setImgSrc] = useState<string>(toCDNUrl(exercise.image_url || ''));
    const [failed, setFailed] = useState(false);

    if (!imgSrc || failed) {
      return <span>{MUSCLE_ICONS[exercise.exercise_type] || '💪'}</span>;
    }

    return (
      <img
        src={imgSrc}
        alt={exercise.exercise_name}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',       // show full image, no cropping
          objectPosition: 'center',
          padding: '0.5rem',          // small breathing room around figure
          background: '#f8f8f8',      // white bg so transparent PNGs look clean
          borderRadius: '8px 8px 0 0',
        }}
        onError={() => {
          // If lh3 CDN also fails, try /uc?export=view as last resort
          if (imgSrc.includes('lh3.googleusercontent.com')) {
            const idMatch = imgSrc.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (idMatch) {
              setImgSrc(`https://drive.google.com/uc?export=view&id=${idMatch[1]}`);
              return;
            }
          }
          // All attempts failed — show emoji
          setFailed(true);
        }}
      />
    );
  };

  return (
    <div className="page-wrap">
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }} className="fade-in">
        <h1 className="section-title">🏋️ Gym Tracker</h1>
        <p className="section-subtitle">Browse exercises and log your workout</p>
      </div>

      {success && <div className="msg-success" style={{ marginBottom: '1rem' }}>{success}</div>}

      {/* Today's workout summary */}
      {todayWorkouts.length > 0 && (
        <div className="glass fade-in-delay-1" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: 800, marginBottom: '0.75rem' }}>📅 Today's Logged Workouts</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {todayWorkouts.map((w) => (
              <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '0.6rem 0.9rem', borderRadius: 8 }}>
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>{w.exercise_name}</span>
                  <span className="badge badge-green" style={{ marginLeft: '0.5rem' }}>{w.exercise_type}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    {w.reps} reps @ {w.weight}kg
                  </span>
                  <button className="btn-danger" onClick={() => handleDeleteWorkout(w.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }} className="fade-in-delay-1">
        {categories.map(cat => (
          <button
            key={cat}
            className={`tag ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {MUSCLE_ICONS[cat] || '🏃'} {cat}
          </button>
        ))}
      </div>

      {/* Exercise grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}><div className="spinner" /></div>
      ) : (
        <div className="grid-3 fade-in-delay-2">
          {exercises.map((ex) => (
            <div key={ex.id} className="exercise-card" onClick={() => { setSelectedExercise(ex); setSets([{ set_number: 1, reps: '', weight: '' }]); setError(''); }}>
              <div className="card-img" style={{ height: 200, background: '#f8f8f8', borderRadius: '8px 8px 0 0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ExerciseImage exercise={ex} />
              </div>
              <div className="card-body">
                <div className="card-name">{ex.exercise_name}</div>
                <div className="card-meta">
                  <span className={`badge ${getDifficultyColor(ex.difficulty)}`}>{ex.difficulty}</span>
                  {ex.equipment && <span className="badge badge-blue">{ex.equipment}</span>}
                </div>
                {ex.target_muscle && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.5 }}>
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

      {/* Log workout modal */}
      {selectedExercise && (
        <div className="modal-overlay" onClick={() => setSelectedExercise(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2>Log: {selectedExercise.exercise_name}</h2>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <span className="badge badge-green">{selectedExercise.exercise_type}</span>
              <span className={`badge ${getDifficultyColor(selectedExercise.difficulty)}`}>{selectedExercise.difficulty}</span>
              {selectedExercise.equipment && <span className="badge badge-blue">{selectedExercise.equipment}</span>}
            </div>

            {selectedExercise.target_muscle && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                🎯 Target: {selectedExercise.target_muscle}
              </p>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Workout Date</label>
              <input type="date" className="input-field" value={workoutDate} onChange={e => setWorkoutDate(e.target.value)} style={{ maxWidth: 200 }} />
            </div>

            {error && <div className="msg-error" style={{ marginBottom: '1rem' }}>{error}</div>}

            {/* Sets table */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
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