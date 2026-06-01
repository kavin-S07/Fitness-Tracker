-- =============================================
-- FITNESS TRACKER - COMPLETE DATABASE SCHEMA
-- Run this in your PostgreSQL database
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  age INT,
  gender VARCHAR(10),
  weight FLOAT,
  height FLOAT,
  goal VARCHAR(20),
  gym_status BOOLEAN DEFAULT false,
  activity_level INT DEFAULT 5,
  bmr FLOAT,
  daily_calories FLOAT,
  daily_protein FLOAT,
  target_weight FLOAT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS foods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  food_name VARCHAR(200) NOT NULL,
  calories FLOAT NOT NULL,
  protein FLOAT NOT NULL,
  carbs FLOAT DEFAULT 0,
  fats FLOAT DEFAULT 0,
  quantity FLOAT DEFAULT 1,
  unit VARCHAR(20) DEFAULT 'g',
  meal_type VARCHAR(20),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exercise (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exercise_type VARCHAR(50) NOT NULL,
  exercise_name VARCHAR(150) NOT NULL,
  image_url TEXT,
  target_muscle VARCHAR(200),
  equipment VARCHAR(200),
  difficulty VARCHAR(20),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workout_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercise(id) ON DELETE CASCADE,
  sets INT NOT NULL,
  reps INT NOT NULL,
  weight FLOAT NOT NULL,
  workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS weight_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  weight FLOAT NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_foods_user_date ON foods(user_id, date);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_date ON workout_logs(user_id, workout_date);
CREATE INDEX IF NOT EXISTS idx_weight_logs_user_date ON weight_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_exercise_type ON exercise(exercise_type);

-- =============================================
-- BUG FIX: Google Drive /file/d/{ID}/view links are NOT embeddable in <img> tags.
-- Must use /uc?export=view&id={ID} format for direct image embedding.
-- Extracted IDs from original sharing URLs and rebuilt as embeddable links.
-- =============================================
INSERT INTO exercise (exercise_type, exercise_name, image_url, target_muscle, equipment, difficulty)
VALUES
('Chest',    'Decline Barbell Press',         'https://drive.google.com/uc?export=view&id=1AP9xzFXulXEM2r2sKKB2QDQWoCYYU_KM', 'Lower Chest, Triceps',             'Barbell, Bench',              'Intermediate'),
('Chest',    'Hammer Strength Chest Press',   'https://drive.google.com/uc?export=view&id=1MdLRtl-3OmGdOQqzMyJejPsY1YhU0I-G', 'Chest, Triceps',                   'Hammer Strength Machine',     'Beginner'),
('Chest',    'Incline Barbell Press',         'https://drive.google.com/uc?export=view&id=1n1Gd1ELl18s8gVDNJLzFcto8itCWF_yW', 'Upper Chest, Shoulders, Triceps', 'Barbell, Incline Bench',      'Intermediate'),
('Chest',    'Incline Dumbbell Fly',          'https://drive.google.com/uc?export=view&id=1_nG_LsGty6c3QXhdjBVKApXWQ_TIGstN', 'Upper Chest',                      'Dumbbells, Incline Bench',    'Intermediate'),
('Back',     'Barbell Bent Over Row',         'https://drive.google.com/uc?export=view&id=1Kckm9iqvol4wiEpiFung0bDS16pGeco7', 'Lats, Rhomboids, Traps',           'Barbell',                     'Intermediate'),
('Back',     'Lat Pulldown',                  'https://drive.google.com/uc?export=view&id=1enpEEhR7T_hQSVIyA1ey5WVRiT1iXlSV', 'Lats, Biceps',                     'Cable Machine',               'Beginner'),
('Back',     'Straight Arm Pulldown',         'https://drive.google.com/uc?export=view&id=1e0wpJ7_Z0IsrLeRQ2LS-fZlIsMnM5-5D', 'Lats',                             'Cable Machine',               'Beginner'),
('Back',     'Wide Grip Pull Up',             'https://drive.google.com/uc?export=view&id=1uuoG3SiHm-iPtfXwZlMVJ3nUE8LuVKPg', 'Lats, Upper Back, Biceps',         'Pull-Up Bar',                 'Advanced'),
('Biceps',   'Barbell Curl',                  'https://drive.google.com/uc?export=view&id=1Cs8-i-lt0Y2Mlnb95_dIWisJNGx0P3Di', 'Biceps',                           'Barbell',                     'Beginner'),
('Biceps',   'Concentration Curl',            'https://drive.google.com/uc?export=view&id=1yp9spcDR-Yj-vfSCFVKzV8d2v-yZqt40', 'Biceps Peak',                      'Dumbbell',                    'Beginner'),
('Biceps',   'Preacher Curl',                 'https://drive.google.com/uc?export=view&id=1huyQ42hGUf7dZ7c6vT4SswcNyBbdV4z0', 'Biceps',                           'Preacher Bench, EZ Bar',      'Intermediate'),
('Biceps',   'Spider Curl',                   'https://drive.google.com/uc?export=view&id=13-4hT-L8LDkpp8KppMdySIKSDPrzBKg4', 'Biceps',                           'Dumbbells, Incline Bench',    'Intermediate'),
('Shoulder', 'Arnold Press',                  'https://drive.google.com/uc?export=view&id=1lCwm2elg6iix9_klqOqzB_M1VTcny2nc', 'Front Delts, Side Delts',          'Dumbbells',                   'Intermediate'),
('Shoulder', 'Dumbbell Press',                'https://drive.google.com/uc?export=view&id=1886YgN2iCIW3h3znjvqVT2N5mL7fU7hV', 'Shoulders, Triceps',               'Dumbbells',                   'Beginner'),
('Shoulder', 'Lateral Raise',                 'https://drive.google.com/uc?export=view&id=1MFJc0I0Ny0Oj6iBJRwPPgxrlAb3HVUBM', 'Side Delts',                       'Dumbbells',                   'Beginner'),
('Shoulder', 'Upright Barbell Row',           'https://drive.google.com/uc?export=view&id=1WKHEY5Sl0V1ody1NqfPGuSbZK4o-Lw0J', 'Shoulders, Traps',                 'Barbell',                     'Intermediate')
ON CONFLICT DO NOTHING;

-- If you already have exercises with the old broken URLs, run this UPDATE to fix them:
UPDATE exercise SET image_url = 'https://drive.google.com/uc?export=view&id=1AP9xzFXulXEM2r2sKKB2QDQWoCYYU_KM' WHERE exercise_name = 'Decline Barbell Press';
UPDATE exercise SET image_url = 'https://drive.google.com/uc?export=view&id=1MdLRtl-3OmGdOQqzMyJejPsY1YhU0I-G' WHERE exercise_name = 'Hammer Strength Chest Press';
UPDATE exercise SET image_url = 'https://drive.google.com/uc?export=view&id=1n1Gd1ELl18s8gVDNJLzFcto8itCWF_yW' WHERE exercise_name = 'Incline Barbell Press';
UPDATE exercise SET image_url = 'https://drive.google.com/uc?export=view&id=1_nG_LsGty6c3QXhdjBVKApXWQ_TIGstN' WHERE exercise_name = 'Incline Dumbbell Fly';
UPDATE exercise SET image_url = 'https://drive.google.com/uc?export=view&id=1Kckm9iqvol4wiEpiFung0bDS16pGeco7' WHERE exercise_name = 'Barbell Bent Over Row';
UPDATE exercise SET image_url = 'https://drive.google.com/uc?export=view&id=1enpEEhR7T_hQSVIyA1ey5WVRiT1iXlSV' WHERE exercise_name = 'Lat Pulldown';
UPDATE exercise SET image_url = 'https://drive.google.com/uc?export=view&id=1e0wpJ7_Z0IsrLeRQ2LS-fZlIsMnM5-5D' WHERE exercise_name = 'Straight Arm Pulldown';
UPDATE exercise SET image_url = 'https://drive.google.com/uc?export=view&id=1uuoG3SiHm-iPtfXwZlMVJ3nUE8LuVKPg' WHERE exercise_name = 'Wide Grip Pull Up';
UPDATE exercise SET image_url = 'https://drive.google.com/uc?export=view&id=1Cs8-i-lt0Y2Mlnb95_dIWisJNGx0P3Di' WHERE exercise_name = 'Barbell Curl';
UPDATE exercise SET image_url = 'https://drive.google.com/uc?export=view&id=1yp9spcDR-Yj-vfSCFVKzV8d2v-yZqt40' WHERE exercise_name = 'Concentration Curl';
UPDATE exercise SET image_url = 'https://drive.google.com/uc?export=view&id=1huyQ42hGUf7dZ7c6vT4SswcNyBbdV4z0' WHERE exercise_name = 'Preacher Curl';
UPDATE exercise SET image_url = 'https://drive.google.com/uc?export=view&id=13-4hT-L8LDkpp8KppMdySIKSDPrzBKg4' WHERE exercise_name = 'Spider Curl';
UPDATE exercise SET image_url = 'https://drive.google.com/uc?export=view&id=1lCwm2elg6iix9_klqOqzB_M1VTcny2nc' WHERE exercise_name = 'Arnold Press';
UPDATE exercise SET image_url = 'https://drive.google.com/uc?export=view&id=1886YgN2iCIW3h3znjvqVT2N5mL7fU7hV' WHERE exercise_name = 'Dumbbell Press';
UPDATE exercise SET image_url = 'https://drive.google.com/uc?export=view&id=1MFJc0I0Ny0Oj6iBJRwPPgxrlAb3HVUBM' WHERE exercise_name = 'Lateral Raise';
UPDATE exercise SET image_url = 'https://drive.google.com/uc?export=view&id=1WKHEY5Sl0V1ody1NqfPGuSbZK4o-Lw0J' WHERE exercise_name = 'Upright Barbell Row';