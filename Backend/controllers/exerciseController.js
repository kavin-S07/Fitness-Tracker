const pool = require('../config/db');

// ============================================
// GET /api/exercise/list
// ============================================
// Used when the exercise library loads (optionally filtered by muscle type).
// Fetches the list of available exercises, grouped by type unless a filter is applied.
const getExercises = async (req, res) => {
  const { type } = req.query;
  try {
    let query = 'SELECT * FROM exercise';
    let params = [];
    if (type) { query += ' WHERE exercise_type = $1'; params.push(type); }
    query += ' ORDER BY exercise_type, exercise_name';
    const result = await pool.query(query, params);
    const grouped = result.rows.reduce((acc, ex) => {
      if (!acc[ex.exercise_type]) acc[ex.exercise_type] = [];
      acc[ex.exercise_type].push(ex);
      return acc;
    }, {});
    res.status(200).json({
      success: true,
      total: result.rows.length,
      // When type filter is present return flat array; otherwise grouped object
      exercises: type ? result.rows : grouped,
    });
  } catch (err) {
    console.error('Get exercises error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ============================================
// GET /api/exercise/categories
// ============================================
// Used when the exercise page loads its category filter options.
// Returns the list of distinct exercise types (muscle groups) available.
const getCategories = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT exercise_type FROM exercise ORDER BY exercise_type'
    );
    res.status(200).json({
      success: true,
      categories: result.rows.map((r) => r.exercise_type),
    });
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ============================================
// GET /api/exercise/:id
// ============================================
// Used when a user clicks on a specific exercise to see its details.
// Fetches one exercise record by its ID.
const getExerciseById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM exercise WHERE id = $1', [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Exercise not found.' });
    res.status(200).json({ success: true, exercise: result.rows[0] });
  } catch (err) {
    console.error('Get exercise by id error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ============================================
// POST /api/exercise/workout/add
//
// Frontend sends an array of sets: [{set_number, reps, weight}]
// Each set is inserted as its own workout_logs row (sets = 1).
// Legacy scalar mode (sets/reps/weight as plain numbers) still supported.
// ============================================
// Used when a user logs a workout on the Exercise page.
// Saves one or more sets (reps/weight) for the chosen exercise on a given date.
const addWorkout = async (req, res) => {
  const { exercise_id, sets, reps, weight, workout_date, notes } = req.body;

  if (!exercise_id) {
    return res.status(400).json({ success: false, message: 'exercise_id is required.' });
  }
  if (sets === undefined) {
    return res.status(400).json({ success: false, message: 'sets is required.' });
  }

  try {
    const exerciseCheck = await pool.query(
      'SELECT id, exercise_name FROM exercise WHERE id = $1',
      [exercise_id]
    );
    if (exerciseCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Exercise not found.' });
    }

    const logDate = workout_date || new Date().toISOString().split('T')[0];
    const exerciseName = exerciseCheck.rows[0].exercise_name;

    // ── Array-of-sets mode (ExercisePage frontend) ──────────────────────
    if (Array.isArray(sets)) {
      if (sets.length === 0) {
        return res.status(400).json({ success: false, message: 'sets array must not be empty.' });
      }
      const invalid = sets.some(s => !s.reps || !s.weight || Number(s.reps) <= 0);
      if (invalid) {
        return res.status(400).json({
          success: false,
          message: 'Each set must have positive reps and weight.',
        });
      }

      const inserted = [];
      for (const s of sets) {
        const result = await pool.query(
          `INSERT INTO workout_logs (user_id, exercise_id, sets, reps, weight, workout_date, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [req.user.id, exercise_id, 1, parseInt(s.reps), parseFloat(s.weight), logDate, notes || null]
        );
        inserted.push(result.rows[0]);
      }

      return res.status(201).json({
        success: true,
        message: `${sets.length} set(s) logged for ${exerciseName}!`,
        workouts: inserted,
      });
    }

    // ── Scalar mode (direct API / legacy) ───────────────────────────────
    if (reps === undefined || weight === undefined) {
      return res.status(400).json({
        success: false,
        message: 'sets, reps, and weight are required.',
      });
    }
    if (parseInt(sets) <= 0 || parseInt(reps) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'sets and reps must be positive integers.',
      });
    }

    const result = await pool.query(
      `INSERT INTO workout_logs (user_id, exercise_id, sets, reps, weight, workout_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        req.user.id,
        exercise_id,
        parseInt(sets),
        parseInt(reps),
        parseFloat(weight),
        logDate,
        notes || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: `Workout logged for ${exerciseName}!`,
      workout: result.rows[0],
    });
  } catch (err) {
    console.error('Add workout error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ============================================
// GET /api/exercise/workout/today
//
// Returns flat array under key "workouts" so ExercisePage can iterate it.
// Also keeps "workout" key for backward compatibility.
// ============================================
// Used when the Exercise page loads to show what the user has logged today.
// Fetches all of today's workout sets along with their exercise details.
const getTodayWorkout = async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  try {
    const result = await pool.query(
      `SELECT
        wl.id,
        wl.sets,
        wl.reps,
        wl.weight,
        wl.workout_date,
        wl.notes,
        e.id          AS exercise_id,
        e.exercise_name,
        e.exercise_type,
        e.image_url,
        e.target_muscle,
        e.equipment
       FROM workout_logs wl
       JOIN exercise e ON wl.exercise_id = e.id
       WHERE wl.user_id = $1 AND wl.workout_date = $2
       ORDER BY e.exercise_type, e.exercise_name, wl.created_at`,
      [req.user.id, today]
    );

    // Cast numeric DB fields to proper JS types
    const workouts = result.rows.map(log => ({
      ...log,
      sets:   parseInt(log.sets),
      reps:   parseInt(log.reps),
      weight: parseFloat(log.weight),
    }));

    res.status(200).json({
      success:    true,
      date:       today,
      total_sets: workouts.length,
      workouts,         // flat array — read by ExercisePage as res.data.workouts
      workout: workouts, // backward compat alias
    });
  } catch (err) {
    console.error('Get today workout error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ============================================
// GET /api/exercise/workout/history
// ============================================
// Used to show a user's recent workout activity.
// Returns a day-by-day summary of workouts logged over the last 30 days.
const getWorkoutHistory = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        wl.workout_date,
        STRING_AGG(DISTINCT e.exercise_type, ', ')  AS muscle_groups,
        COUNT(wl.id)::int                            AS total_entries,
        SUM(wl.sets)::int                            AS total_sets,
        COUNT(DISTINCT wl.exercise_id)::int          AS exercises_count
       FROM workout_logs wl
       JOIN exercise e ON wl.exercise_id = e.id
       WHERE wl.user_id = $1 AND wl.workout_date >= NOW() - INTERVAL '30 days'
       GROUP BY wl.workout_date
       ORDER BY wl.workout_date DESC`,
      [req.user.id]
    );

    res.status(200).json({ success: true, history: result.rows });
  } catch (err) {
    console.error('Get workout history error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ============================================
// GET /api/exercise/workout/progress/:exercise_id
// ============================================
// Used when a user views their progress chart for a specific exercise.
// Returns the max weight, total sets, and average reps logged per day for that exercise.
const getExerciseProgress = async (req, res) => {
  const { exercise_id } = req.params;
  try {
    const exercise = await pool.query(
      'SELECT exercise_name FROM exercise WHERE id = $1',
      [exercise_id]
    );
    if (exercise.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Exercise not found.' });

    const result = await pool.query(
      `SELECT
        workout_date,
        MAX(weight)::float            AS max_weight,
        SUM(sets)::int                AS total_sets,
        ROUND(AVG(reps)::numeric, 1)  AS avg_reps
       FROM workout_logs
       WHERE user_id = $1 AND exercise_id = $2
       GROUP BY workout_date
       ORDER BY workout_date ASC`,
      [req.user.id, exercise_id]
    );

    res.status(200).json({
      success:       true,
      exercise_name: exercise.rows[0].exercise_name,
      progress:      result.rows,
    });
  } catch (err) {
    console.error('Get exercise progress error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ============================================
// DELETE /api/exercise/workout/:id
// ============================================
// Used when a user deletes a logged workout entry.
// Removes the workout log if it belongs to the requesting user.
const deleteWorkout = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM workout_logs WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Workout log not found.' });
    res.status(200).json({ success: true, message: 'Workout entry deleted.' });
  } catch (err) {
    console.error('Delete workout error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


// ============================================
// GET /api/exercise/workout/all
// Returns all workout logs for the user within last N days
// ============================================
// Used when a user wants to view their full workout history.
// Returns all workout logs from the last N days (default 90) with exercise details.
const getAllWorkouts = async (req, res) => {
  const days = parseInt(req.query.days) || 90;
  try {
    const result = await pool.query(
      `SELECT
        wl.id,
        wl.sets,
        wl.reps,
        wl.weight,
        wl.workout_date,
        wl.notes,
        e.id          AS exercise_id,
        e.exercise_name,
        e.exercise_type,
        e.target_muscle,
        e.equipment
       FROM workout_logs wl
       JOIN exercise e ON wl.exercise_id = e.id
       WHERE wl.user_id = $1 AND wl.workout_date >= NOW() - INTERVAL '${days} days'
       ORDER BY wl.workout_date DESC, wl.created_at ASC`,
      [req.user.id]
    );

    const workouts = result.rows.map(log => ({
      ...log,
      sets: parseInt(log.sets),
      reps: parseInt(log.reps),
      weight: parseFloat(log.weight),
    }));

    res.status(200).json({
      success: true,
      total: workouts.length,
      workouts,
    });
  } catch (err) {
    console.error('Get all workouts error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getExercises,
  getCategories,
  getExerciseById,
  addWorkout,
  getTodayWorkout,
  getWorkoutHistory,
  getExerciseProgress,
  deleteWorkout,
  getAllWorkouts,
};