// ============================================================
// scripts/importFoodReference.js
//
// One-time import of a nutrition CSV (e.g. Indian_Food_Nutrition_
// Processed.csv) into the food_reference table.
//
// Usage:
//   node scripts/importFoodReference.js ./Indian_Food_Nutrition_Processed.csv
//
// Requires: npm install csv-parse
// ============================================================
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const pool = require('../config/db');

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: node scripts/importFoodReference.js <path-to-csv>');
    process.exit(1);
  }

  const raw = fs.readFileSync(path.resolve(csvPath), 'utf8');
  const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true });

  console.log(`Parsed ${rows.length} rows from ${csvPath}`);

  // Wipe and reload — safe to re-run whenever you refresh the dataset.
  await pool.query('TRUNCATE TABLE food_reference RESTART IDENTITY');

  const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  let inserted = 0;
  for (const row of rows) {
    const dishName = row['Dish Name'];
    if (!dishName) continue;

    await pool.query(
      `INSERT INTO food_reference (dish_name, calories, carbs, protein, fats, fibre, sodium)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        dishName.trim(),
        num(row['Calories (kcal)']),
        num(row['Carbohydrates (g)']),
        num(row['Protein (g)']),
        num(row['Fats (g)']),
        num(row['Fibre (g)']),
        num(row['Sodium (mg)']),
      ]
    );
    inserted++;
  }

  console.log(`Inserted ${inserted} food_reference rows.`);
  await pool.end();
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
