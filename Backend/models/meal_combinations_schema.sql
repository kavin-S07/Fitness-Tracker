-- =============================================================
-- meal_combinations / meal_combination_items
--
-- Backs the Food Tracker's "Suggest a meal" feature
-- (GET /api/food/suggest, GET /api/food/random). Populated once
-- via scripts/importMealCombinations.js from the four
-- data/<meal>_combos_final.csv files.
--
-- meal_combinations stores the pre-generated combo totals exactly
-- as computed at CSV-generation time (accurate, since they were
-- derived from food_nutrition_reference already). meal_combination_items
-- links each combo back to the real food_nutrition_reference rows so the
-- frontend can show a full item breakdown and batch-log every
-- component in one go.
--
-- Run this once against your Postgres database (it's also
-- auto-ensured on server startup — see server.js — so running it
-- by hand is optional, but kept here for consistency with the
-- rest of /models).
-- =============================================================

CREATE TABLE IF NOT EXISTS meal_combinations (
    id              SERIAL PRIMARY KEY,
    meal_type       VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    combo_name      TEXT NOT NULL,
    total_calories  NUMERIC NOT NULL,
    total_protein   NUMERIC NOT NULL,
    total_carbs     NUMERIC NOT NULL DEFAULT 0,
    total_fat       NUMERIC NOT NULL DEFAULT 0,
    -- Original row id from the source CSV (per meal type). Combined with
    -- meal_type this lets the import script be safely re-run without
    -- creating duplicate combos.
    csv_source_id   INTEGER,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE (meal_type, csv_source_id)
);

CREATE TABLE IF NOT EXISTS meal_combination_items (
    id                   SERIAL PRIMARY KEY,
    combination_id       INTEGER NOT NULL REFERENCES meal_combinations(id) ON DELETE CASCADE,
    food_reference_id    INTEGER NOT NULL REFERENCES food_nutrition_reference(id),
    quantity_multiplier  NUMERIC NOT NULL DEFAULT 1,
    created_at           TIMESTAMP DEFAULT NOW()
);

-- Suggestion query filters/sorts by meal_type + total_calories/total_protein
-- and needs to fetch a combo's items quickly by combination_id.
CREATE INDEX IF NOT EXISTS idx_meal_combinations_type_cal_pro
    ON meal_combinations (meal_type, total_calories, total_protein);

CREATE INDEX IF NOT EXISTS idx_meal_combination_items_combo
    ON meal_combination_items (combination_id);
