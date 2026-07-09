-- ============================================================
-- food_reference table
-- Holds the nutrition lookup dataset used to auto-fill calories
-- and protein when a user types a food name manually.
-- Populate this once via scripts/importFoodReference.js
-- ============================================================

CREATE TABLE IF NOT EXISTS food_reference (
  id         SERIAL PRIMARY KEY,
  dish_name  TEXT    NOT NULL,
  calories   NUMERIC NOT NULL DEFAULT 0,
  carbs      NUMERIC NOT NULL DEFAULT 0,
  protein    NUMERIC NOT NULL DEFAULT 0,
  fats       NUMERIC NOT NULL DEFAULT 0,
  fibre      NUMERIC DEFAULT 0,
  sodium     NUMERIC DEFAULT 0
);

-- Speeds up exact/prefix lookups; the fuzzy matching itself happens
-- in-memory in Node (see services/foodMatchService.js), since the
-- dataset is small (~1000 rows) and needs custom similarity scoring
-- that plain SQL can't do efficiently.
CREATE INDEX IF NOT EXISTS idx_food_reference_dish_name
  ON food_reference (LOWER(dish_name));
