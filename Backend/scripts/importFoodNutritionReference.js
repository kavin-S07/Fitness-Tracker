// ============================================================
// scripts/importFoodNutritionReference.js
//
// One-time import of data/food_nutrition.csv into the
// food_nutrition_reference table (used by the Food Tracker's
// live-search autocomplete: GET /api/food/search).
//
// Usage:
//   node scripts/importFoodNutritionReference.js
//   (or: npm run import:food-nutrition-reference)
//
// Requires: npm install csv-parse   (already in package.json)
// Safe to re-run — duplicate (food_name, serving_quantity) rows
// are skipped via ON CONFLICT DO NOTHING.
// ============================================================
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const pool = require('../config/db');

const CSV_PATH = path.join(__dirname, '..', 'data', 'food_nutrition.csv');

// Extracts a numeric gram value from strings like:
// "1 piece (~50g)", "100 g", "100 g (~100ml)"
function parseServingGrams(servingQuantity) {
  if (!servingQuantity) return null;
  const match = servingQuantity.match(/([\d.]+)\s*g\b/i);
  return match ? parseFloat(match[1]) : null;
}

function toNumericOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = parseFloat(value);
  return Number.isNaN(n) ? null : n;
}

async function importCsv() {
  const fileContent = fs.readFileSync(CSV_PATH, { encoding: 'utf-8' });
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  });

  console.log(`Parsed ${records.length} rows from ${CSV_PATH}`);

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;

  try {
    await client.query('BEGIN');

    for (const row of records) {
      if (!row.food_name) continue;

      const servingGrams = parseServingGrams(row.serving_quantity);

      const values = [
        row.food_name.trim(),
        row.serving_quantity ? row.serving_quantity.trim() : null,
        servingGrams,
        toNumericOrNull(row.calories_kcal),
        toNumericOrNull(row.protein_g),
        toNumericOrNull(row.carbohydrates_g),
        toNumericOrNull(row.fat_g),
        toNumericOrNull(row.fiber_g),
        toNumericOrNull(row.sugar_g),
        toNumericOrNull(row.saturated_fat_g),
        toNumericOrNull(row.cholesterol_mg),
        toNumericOrNull(row.sodium_mg),
        toNumericOrNull(row.potassium_mg),
        toNumericOrNull(row.calcium_mg),
        toNumericOrNull(row.iron_mg),
        toNumericOrNull(row.magnesium_mg),
        toNumericOrNull(row.phosphorus_mg),
        toNumericOrNull(row.zinc_mg),
        toNumericOrNull(row.vitamin_a_ug),
        toNumericOrNull(row.vitamin_b1_mg),
        toNumericOrNull(row.vitamin_b2_mg),
        toNumericOrNull(row.vitamin_b3_mg),
        toNumericOrNull(row.vitamin_b5_mg),
        toNumericOrNull(row.vitamin_b6_mg),
        toNumericOrNull(row.vitamin_b9_ug),
        toNumericOrNull(row.vitamin_b12_ug),
        toNumericOrNull(row.vitamin_c_mg),
        toNumericOrNull(row.vitamin_d_ug),
        toNumericOrNull(row.vitamin_e_mg),
        toNumericOrNull(row.vitamin_k_ug),
      ];

      const result = await client.query(
        `INSERT INTO food_nutrition_reference (
          food_name, serving_quantity, serving_grams,
          calories_kcal, protein_g, carbohydrates_g, fat_g,
          fiber_g, sugar_g, saturated_fat_g, cholesterol_mg,
          sodium_mg, potassium_mg, calcium_mg, iron_mg,
          magnesium_mg, phosphorus_mg, zinc_mg, vitamin_a_ug,
          vitamin_b1_mg, vitamin_b2_mg, vitamin_b3_mg, vitamin_b5_mg,
          vitamin_b6_mg, vitamin_b9_ug, vitamin_b12_ug, vitamin_c_mg,
          vitamin_d_ug, vitamin_e_mg, vitamin_k_ug
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
          $16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30
        )
        ON CONFLICT (food_name, serving_quantity) DO NOTHING
        RETURNING id`,
        values
      );

      if (result.rowCount > 0) {
        inserted += 1;
      } else {
        skipped += 1;
      }
    }

    await client.query('COMMIT');
    console.log(`Import complete. Inserted: ${inserted}, Skipped (duplicates): ${skipped}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import failed, rolled back:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

importCsv();
