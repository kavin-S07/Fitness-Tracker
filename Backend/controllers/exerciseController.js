const { db } = require('../db');
const { exercise, workoutLogs } = require('../db/schema');
const { eq, and, sql } = require('drizzle-orm');

const getExercises = async (req, res) => {
  const { type } = req.query;
  try {
    let result;
    if (type) {
      result = await db.select().from(exercise).where(eq(exercise.exercise_type, type)).orderBy(exercise.exercise_type, exercise.exercise_name);
    } else {
      result = await db.select().from(exercise).orderBy(exercise.exercise_type, exercise.exercise_name);
    }

    const grouped = result.reduce((acc, ex) => {
      if (!acc[ex.exercise_type]) acc[ex.exercise_type] = [];
      acc[ex.exercise_type].push(ex);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      total: result.length,
      exercises: type ? result : grouped,
    });
  } catch (err) {
    console.error('Get exercises error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getCategories = async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT DISTINCT exercise_type FROM exercise ORDER BY exercise_type
    `);
    res.status(200).json({
      success: true,
      categories: result.rows.map((r) => r.exercise_type),
    });
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getExerciseById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.select().from(exercise).where(eq(exercise.id, id));
    if (result.length === 0)
      return res.status(404).json({ success: false, message: 'Exercise not found.' });
    res.status(200).json({ success: true, exercise: result[0] });
  } catch (err) {
    console.error('Get exercise by id error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const addWorkout = async (req, res) => {
  const { exercise_id, sets, reps, weight, workout_date, notes } = req.body;

  if (!exercise_id) {
    return res.status(400).json({ success: false, message: 'exercise_id is required.' });
  }
  if (sets === undefined) {
    return res.status(400).json({ success: false, message: 'sets is required.' });
  }

  try {
    const exerciseCheck = await db.select({ id: exercise.id, exercise_name: exercise.exercise_name }).from(exercise).where(eq(exercise.id, exercise_id));
    if (exerciseCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'Exercise not found.' });
    }

    const logDate = workout_date || new Date().toISOString().split('T')[0];
    const exerciseName = exerciseCheck[0].exercise_name;

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
        const result = await db.insert(workoutLogs).values({
          user_id: req.user.id,
          exercise_id,
          sets: 1,
          reps: parseInt(s.reps),
          weight: parseFloat(s.weight),
          workout_date: logDate,
          notes: notes || null,
        }).returning();
        inserted.push(result[0]);
      }

      return res.status(201).json({
        success: true,
        message: `${sets.length} set(s) logged for ${exerciseName}!`,
        workouts: inserted,
      });
    }

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

    const result = await db.insert(workoutLogs).values({
      user_id: req.user.id,
      exercise_id,
      sets: parseInt(sets),
      reps: parseInt(reps),
      weight: parseFloat(weight),
      workout_date: logDate,
      notes: notes || null,
    }).returning();

    res.status(201).json({
      success: true,
      message: `Workout logged for ${exerciseName}!`,
      workout: result[0],
    });
  } catch (err) {
    console.error('Add workout error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getTodayWorkout = async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  try {
    const result = await db.execute(sql`
      SELECT
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
      WHERE wl.user_id = ${req.user.id} AND wl.workout_date = ${today}
      ORDER BY e.exercise_type, e.exercise_name, wl.created_at
    `);

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
      workouts,
      workout: workouts,
    });
  } catch (err) {
    console.error('Get today workout error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getWorkoutHistory = async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        wl.workout_date,
        STRING_AGG(DISTINCT e.exercise_type, ', ')  AS muscle_groups,
        COUNT(wl.id)::int                            AS total_entries,
        SUM(wl.sets)::int                            AS total_sets,
        COUNT(DISTINCT wl.exercise_id)::int          AS exercises_count
      FROM workout_logs wl
      JOIN exercise e ON wl.exercise_id = e.id
      WHERE wl.user_id = ${req.user.id} AND wl.workout_date >= NOW() - INTERVAL '30 days'
      GROUP BY wl.workout_date
      ORDER BY wl.workout_date DESC
    `);

    res.status(200).json({ success: true, history: result.rows });
  } catch (err) {
    console.error('Get workout history error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getExerciseProgress = async (req, res) => {
  const { exercise_id } = req.params;
  try {
    const exerciseResult = await db.select({ exercise_name: exercise.exercise_name }).from(exercise).where(eq(exercise.id, exercise_id));
    if (exerciseResult.length === 0)
      return res.status(404).json({ success: false, message: 'Exercise not found.' });

    const result = await db.execute(sql`
      SELECT
        workout_date,
        MAX(weight)::float            AS max_weight,
        SUM(sets)::int                AS total_sets,
        ROUND(AVG(reps)::numeric, 1)  AS avg_reps
      FROM workout_logs
      WHERE user_id = ${req.user.id} AND exercise_id = ${exercise_id}
      GROUP BY workout_date
      ORDER BY workout_date ASC
    `);

    res.status(200).json({
      success:       true,
      exercise_name: exerciseResult[0].exercise_name,
      progress:      result.rows,
    });
  } catch (err) {
    console.error('Get exercise progress error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const deleteWorkout = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.delete(workoutLogs).where(and(eq(workoutLogs.id, id), eq(workoutLogs.user_id, req.user.id))).returning({ id: workoutLogs.id });
    if (result.length === 0)
      return res.status(404).json({ success: false, message: 'Workout log not found.' });
    res.status(200).json({ success: true, message: 'Workout entry deleted.' });
  } catch (err) {
    console.error('Delete workout error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getAllWorkouts = async (req, res) => {
  const days = parseInt(req.query.days) || 90;
  try {
    const result = await db.execute(sql`
      SELECT
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
      WHERE wl.user_id = ${req.user.id} AND wl.workout_date >= NOW() - INTERVAL '1 day' * ${days}
      ORDER BY wl.workout_date DESC, wl.created_at ASC
    `);

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
