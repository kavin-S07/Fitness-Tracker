// ============================================================
// scripts/importMealCombinations.js
//
// One-time import of data/breakfast_combos_final.csv,
// data/lunch_combos_final.csv, data/dinner_combos_final.csv and
// data/snack_combos_final.csv into meal_combinations +
// meal_combination_items (see models/meal_combinations_schema.sql).
//
// Each CSV row looks like:
//   id,name,calories,protein,carbs,fat
//   4,"2 Appam + 100g Grilled Chicken + Sambar",420,35.9,43.3,10.6
//
// For every row this script:
//   1. Splits `name` on " + " into component parts.
//   2. Splits each part into a leading quantity/unit token and a food label
//      (e.g. "150g Tomato Rice" -> qty=150 g, label="Tomato Rice";
//       "3 Idli" -> qty=3 pieces, label="Idli";
//       "Sambar" -> qty=1 (no explicit quantity), label="Sambar").
//   3. Fuzzy-matches the food label against food_nutrition_reference.food_name
//      (case-insensitive, trims, and understands " / " alias lists such as
//      "Chapati / Phulka" or "Rajma Curry / Chole Masala").
//   4. If every item in the combo matches, inserts one meal_combinations row
//      (using the CSV's own calories/protein/carbs/fat as the stored totals)
//      plus one meal_combination_items row per component.
//   5. If ANY item fails to match, the whole combo is skipped (not inserted
//      with nulls) and logged to unmatched_combo_items.log for manual
//      alias fixing.
//
// Usage:
//   node scripts/importMealCombinations.js
//   (or: npm run import:meal-combinations)
//
// Safe to re-run — combos already imported (matched on meal_type +
// csv_source_id) are skipped via ON CONFLICT DO NOTHING.
// ============================================================
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const pool = require('../config/db');

const MEAL_FILES = {
  breakfast: 'breakfast_combos_final.csv',
  lunch: 'lunch_combos_final.csv',
  dinner: 'dinner_combos_final.csv',
  snack: 'snack_combos_final.csv',
};

const DATA_DIR = path.join(__dirname, '..', 'data');
const UNMATCHED_LOG_PATH = path.join(DATA_DIR, 'unmatched_combo_items.log');

// ------------------------------------------------------------------
// Parsing helpers
// ------------------------------------------------------------------

// Splits "2 Kal Dosa + 4 Egg Whites + Sambar" into
// ["2 Kal Dosa", "4 Egg Whites", "Sambar"]
function splitComboName(name) {
  return name
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Splits a single component like "150g Tomato Rice" or "3 Idli" or
// "Sambar" into { quantity, unit, label }.
//   "150g Tomato Rice"       -> { quantity: 150, unit: 'g',  label: 'Tomato Rice' }
//   "3 Idli"                 -> { quantity: 3,   unit: null, label: 'Idli' }
//   "Sambar"                 -> { quantity: 1,   unit: null, label: 'Sambar' }
//   "Rajma / Chole"          -> { quantity: 1,   unit: null, label: 'Rajma / Chole' }
function parseComboItem(part) {
  const match = part.match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l)?\s*(.+)$/i);
  if (!match) {
    return { quantity: 1, unit: null, label: part.trim() };
  }
  const [, qtyStr, unitStr, labelStr] = match;
  return {
    quantity: parseFloat(qtyStr),
    unit: unitStr ? unitStr.toLowerCase() : null,
    label: labelStr.trim(),
  };
}

// Tokenizes on any non-alphanumeric run, so "Avial/Kootu" and
// "Avial / Kootu" and "Chapati / Phulka" all tokenize consistently
// regardless of spacing around the "/" alias separator.
function tokenize(str) {
  return String(str)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

// Scores how well a label's tokens match a reference food_name's tokens.
// Mirrors the precision/recall blend used by services/foodMatchService.js
// for the free-text /api/food/predict matcher.
function scoreMatch(labelTokens, refTokens) {
  if (labelTokens.length === 0 || refTokens.length === 0) return 0;
  let overlap = 0;
  for (const t of labelTokens) {
    if (refTokens.includes(t)) overlap += 1;
    else if (refTokens.some((r) => r.length > 2 && (r.includes(t) || t.includes(r)))) overlap += 0.6;
  }
  const precision = overlap / refTokens.length;
  const recall = overlap / labelTokens.length;
  return precision * 0.4 + recall * 0.6;
}

const MATCH_THRESHOLD = 0.55;

// Finds the best food_nutrition_reference match for a parsed label.
// `referenceRows` is the full in-memory list: [{ id, food_name, serving_grams, ... }]
function matchFoodLabel(label, referenceRows) {
  const cleanLabel = label.trim().toLowerCase();

  // 1. Exact match (case-insensitive) on the whole food_name.
  let exact = referenceRows.find((r) => r.food_name.trim().toLowerCase() === cleanLabel);
  if (exact) return { row: exact, score: 1 };

  // 2. Exact match against one alias segment of a "A / B / C" food_name.
  exact = referenceRows.find((r) =>
    r.food_name
      .split('/')
      .map((a) => a.trim().toLowerCase())
      .includes(cleanLabel)
  );
  if (exact) return { row: exact, score: 1 };

  // 3. Fuzzy token-overlap match, allowing partial/alias matches like
  //    "Rajma / Chole" -> "Rajma Curry / Chole Masala".
  const labelTokens = tokenize(label);
  let best = null;
  let bestScore = 0;
  for (const row of referenceRows) {
    const score = scoreMatch(labelTokens, tokenize(row.food_name));
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }

  if (best && bestScore >= MATCH_THRESHOLD) {
    return { row: best, score: bestScore };
  }
  return null;
}

// Converts a parsed { quantity, unit } into a quantity_multiplier relative
// to the matched reference row's serving size, so items can later be
// scaled correctly when batch-logging a combo.
function computeMultiplier({ quantity, unit }, referenceRow) {
  if (unit && ['g', 'kg', 'ml', 'l'].includes(unit) && referenceRow.serving_grams) {
    const grams = unit === 'kg' || unit === 'l' ? quantity * 1000 : quantity;
    const multiplier = grams / parseFloat(referenceRow.serving_grams);
    return Math.max(0.1, Math.round(multiplier * 100) / 100);
  }
  // No gram unit (piece-based, e.g. "3 Idli") or no serving_grams to scale
  // against — treat the parsed quantity as a direct piece/serving count.
  return Math.max(0.1, Math.round(quantity * 100) / 100);
}

function toNumericOrZero(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

// ------------------------------------------------------------------
// Main import
// ------------------------------------------------------------------
async function loadReferenceRows(client) {
  const result = await client.query(
    `SELECT id, food_name, serving_grams FROM food_nutrition_reference`
  );
  return result.rows;
}

async function importMealType(client, mealType, csvFileName, referenceRows, unmatchedLog) {
  const csvPath = path.join(DATA_DIR, csvFileName);
  if (!fs.existsSync(csvPath)) {
    console.warn(`⚠️  Skipping ${mealType}: ${csvPath} not found.`);
    return { inserted: 0, duplicates: 0, skippedUnmatched: 0 };
  }

  const fileContent = fs.readFileSync(csvPath, { encoding: 'utf-8' });
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  });

  let inserted = 0;
  let duplicates = 0;
  let skippedUnmatched = 0;

  for (const row of records) {
    if (!row.name) continue;

    const parts = splitComboName(row.name);
    const resolvedItems = [];
    const unmatchedLabels = [];

    for (const part of parts) {
      const parsed = parseComboItem(part);
      const matched = matchFoodLabel(parsed.label, referenceRows);
      if (!matched) {
        unmatchedLabels.push(parsed.label);
        continue;
      }
      resolvedItems.push({
        food_reference_id: matched.row.id,
        quantity_multiplier: computeMultiplier(parsed, matched.row),
      });
    }

    if (unmatchedLabels.length > 0) {
      skippedUnmatched += 1;
      const logLine = `[${mealType}] combo #${row.id} "${row.name}" — unmatched: ${unmatchedLabels.join(', ')}\n`;
      unmatchedLog.push(logLine);
      console.warn(`⚠️  ${logLine.trim()}`);
      continue; // skip the whole combo — do not insert with nulls
    }

    const comboResult = await client.query(
      `INSERT INTO meal_combinations
         (meal_type, combo_name, total_calories, total_protein, total_carbs, total_fat, csv_source_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (meal_type, csv_source_id) DO NOTHING
       RETURNING id`,
      [
        mealType,
        row.name.trim(),
        toNumericOrZero(row.calories),
        toNumericOrZero(row.protein),
        toNumericOrZero(row.carbs),
        toNumericOrZero(row.fat),
        parseInt(row.id, 10) || null,
      ]
    );

    if (comboResult.rows.length === 0) {
      duplicates += 1;
      continue; // already imported on a previous run
    }

    const combinationId = comboResult.rows[0].id;
    for (const item of resolvedItems) {
      await client.query(
        `INSERT INTO meal_combination_items (combination_id, food_reference_id, quantity_multiplier)
         VALUES ($1,$2,$3)`,
        [combinationId, item.food_reference_id, item.quantity_multiplier]
      );
    }
    inserted += 1;
  }

  return { inserted, duplicates, skippedUnmatched };
}

async function importAll() {
  const client = await pool.connect();
  const unmatchedLog = [];
  const totals = { inserted: 0, duplicates: 0, skippedUnmatched: 0 };

  try {
    const referenceRows = await loadReferenceRows(client);
    if (referenceRows.length === 0) {
      console.error(
        '❌ food_nutrition_reference is empty. Run "npm run import:food-nutrition-reference" first.'
      );
      process.exitCode = 1;
      return;
    }
    console.log(`Loaded ${referenceRows.length} food_nutrition_reference rows for matching.`);

    for (const [mealType, csvFileName] of Object.entries(MEAL_FILES)) {
      await client.query('BEGIN');
      try {
        const result = await importMealType(client, mealType, csvFileName, referenceRows, unmatchedLog);
        await client.query('COMMIT');
        totals.inserted += result.inserted;
        totals.duplicates += result.duplicates;
        totals.skippedUnmatched += result.skippedUnmatched;
        console.log(
          `✅ ${mealType}: inserted ${result.inserted}, duplicates skipped ${result.duplicates}, unmatched skipped ${result.skippedUnmatched}`
        );
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Import failed for ${mealType}, rolled back:`, err);
        process.exitCode = 1;
      }
    }

    if (unmatchedLog.length > 0) {
      fs.writeFileSync(UNMATCHED_LOG_PATH, unmatchedLog.join(''), 'utf-8');
      console.log(
        `\n📝 ${unmatchedLog.length} combo(s) had unmatched food labels — see ${UNMATCHED_LOG_PATH} for manual alias fixes.`
      );
    }

    console.log(
      `\nImport complete. Inserted: ${totals.inserted}, Duplicates skipped: ${totals.duplicates}, Unmatched skipped: ${totals.skippedUnmatched}`
    );
  } finally {
    client.release();
    await pool.end();
  }
}

importAll();
