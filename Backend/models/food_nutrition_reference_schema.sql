-- =============================================
-- food_nutrition_reference
--
-- Lookup dataset backing the Food Tracker's live-search autocomplete
-- (GET /api/food/search, GET /api/food/reference/:id). Populated once
-- via scripts/importFoodNutritionReference.js from data/food_nutrition.csv.
--
-- This is separate from the older food_reference table (used by the
-- /api/food/predict fuzzy-match endpoint) — different shape, different
-- dataset, different use case. Both can coexist.
-- =============================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS food_nutrition_reference (
    id SERIAL PRIMARY KEY,
    food_name VARCHAR(255) NOT NULL,
    serving_quantity VARCHAR(100),     -- e.g. "1 piece (~50g)" or "100 g"
    serving_grams NUMERIC,             -- parsed numeric grams (nullable if not parseable)
    calories_kcal NUMERIC NOT NULL,
    protein_g NUMERIC NOT NULL,
    carbohydrates_g NUMERIC NOT NULL,
    fat_g NUMERIC NOT NULL,
    fiber_g NUMERIC,
    sugar_g NUMERIC,
    saturated_fat_g NUMERIC,
    cholesterol_mg NUMERIC,
    sodium_mg NUMERIC,
    potassium_mg NUMERIC,
    calcium_mg NUMERIC,
    iron_mg NUMERIC,
    magnesium_mg NUMERIC,
    phosphorus_mg NUMERIC,
    zinc_mg NUMERIC,
    vitamin_a_ug NUMERIC,
    vitamin_b1_mg NUMERIC,
    vitamin_b2_mg NUMERIC,
    vitamin_b3_mg NUMERIC,
    vitamin_b5_mg NUMERIC,
    vitamin_b6_mg NUMERIC,
    vitamin_b9_ug NUMERIC,
    vitamin_b12_ug NUMERIC,
    vitamin_c_mg NUMERIC,
    vitamin_d_ug NUMERIC,
    vitamin_e_mg NUMERIC,
    vitamin_k_ug NUMERIC,
    UNIQUE (food_name, serving_quantity)
);

-- Fast case-insensitive partial-text search on food name
CREATE INDEX IF NOT EXISTS idx_food_nutrition_reference_name_trgm
    ON food_nutrition_reference USING gin (food_name gin_trgm_ops);
