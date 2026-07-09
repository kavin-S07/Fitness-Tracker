// ============================================================
// services/foodMatchService.js
//
// CSV-backed nutrition lookup used as the fallback (or primary, when
// API_NINJAS_KEY is missing/invalid) nutrition source for
// GET /api/food/predict.
//
// Understands quantities in free text, e.g.:
//   "2 dosa"                  -> quantity=2, food="dosa"
//   "4 boiled eggs"           -> quantity=4, food="boiled eggs"
//   "1 plate mutton biryani"  -> quantity=1 ("plate" is a serving word), food="mutton biryani"
//
// The reference dataset (Indian_Food_Nutrition_Processed.csv) gives
// nutrition PER SERVING/PIECE already, so matched values are simply
// multiplied by the parsed quantity.
// ============================================================
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const CSV_PATH = path.join(__dirname, '..', 'data', 'Indian_Food_Nutrition_Processed.csv');

let REFERENCE = null; // cached in-memory dataset, loaded once

function loadReference() {
  if (REFERENCE) return REFERENCE;

  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true });

  const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  REFERENCE = rows
    .filter((r) => r['Dish Name'])
    .map((r) => ({
      dish_name: r['Dish Name'].trim(),
      calories: num(r['Calories (kcal)']),
      carbs: num(r['Carbohydrates (g)']),
      protein: num(r['Protein (g)']),
      fats: num(r['Fats (g)']),
      fiber: num(r['Fibre (g)']),
      sodium: num(r['Sodium (mg)']),
    }));

  return REFERENCE;
}

// Words describing a container/serving rather than the food itself.
const UNIT_WORDS = new Set([
  'plate', 'plates', 'bowl', 'bowls', 'cup', 'cups', 'glass', 'glasses',
  'piece', 'pieces', 'slice', 'slices', 'serving', 'servings', 'spoon',
  'spoons', 'tbsp', 'tsp', 'katori', 'katoris', 'packet', 'packets',
  'bottle', 'bottles', 'can', 'cans', 'of',
]);

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, half: 0.5, a: 1, an: 1, couple: 2, few: 3,
};

// Pulls a leading quantity (and optional serving/unit word) off a free-text
// query, returning the remaining food term to match against the dataset.
function parseQuantity(query) {
  const words = String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { quantity: 1, term: '' };

  let quantity = 1;
  let consumed = 0;
  const first = words[0];

  const numMatch = first.match(/^(\d+(?:\.\d+)?)x?$/); // "2", "2.5", "2x"
  const fracMatch = first.match(/^(\d+)\/(\d+)$/);       // "1/2"

  if (numMatch) {
    quantity = parseFloat(numMatch[1]);
    consumed = 1;
  } else if (fracMatch) {
    quantity = parseFloat(fracMatch[1]) / parseFloat(fracMatch[2]);
    consumed = 1;
  } else if (NUMBER_WORDS[first] !== undefined) {
    quantity = NUMBER_WORDS[first];
    consumed = 1;
  }

  let rest = words.slice(consumed);

  // Drop a leading serving/unit word ("plate", "cup", ...) — it describes
  // the container, not the food — but only if something is left after it.
  while (rest.length > 1 && UNIT_WORDS.has(rest[0])) {
    rest = rest.slice(1);
  }

  return { quantity: quantity > 0 ? quantity : 1, term: rest.join(' ') };
}

// Minimal singularizer, used only for match scoring (never for display).
function singularize(word) {
  if (word.length > 3 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('es') && !word.endsWith('ses')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function normalizeWords(str) {
  return String(str)
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(singularize);
}

// Scores how well a query's words match a dish name's words (0..1).
function scoreMatch(queryWords, dishWords) {
  if (queryWords.length === 0 || dishWords.length === 0) return 0;

  let overlap = 0;
  for (const w of queryWords) {
    if (dishWords.includes(w)) overlap += 1;
    else if (dishWords.some((d) => d.length > 2 && (d.includes(w) || w.includes(d)))) overlap += 0.6;
  }

  const precision = overlap / dishWords.length; // penalises long/unrelated dish names
  const recall = overlap / queryWords.length;   // rewards covering everything the user typed

  return precision * 0.4 + recall * 0.6;
}

/**
 * predictNutrition — look up nutrition for a free-text food query.
 * @param {string} query  e.g. "2 dosa", "4 boiled eggs", "1 plate mutton biryani"
 * @param {number} limit  max number of candidate matches to return
 */
async function predictNutrition(query, limit = 5) {
  const reference = loadReference();
  const { quantity, term } = parseQuantity(query);
  const searchTerm = term || String(query).trim();
  const queryWords = normalizeWords(searchTerm);

  const scored = reference
    .map((item) => ({ item, score: scoreMatch(queryWords, normalizeWords(item.dish_name)) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const scale = (n) => Math.round(n * quantity * 100) / 100;

  const matches = scored.slice(0, limit).map(({ item, score }) => ({
    dish_name: item.dish_name,
    score: Math.round(score * 100) / 100,
    calories: scale(item.calories),
    protein: scale(item.protein),
    carbs: scale(item.carbs),
    fats: scale(item.fats),
    fiber: scale(item.fiber),
  }));

  const best = matches[0];
  const confident = !!best && best.score >= 0.6;

  return {
    confident,
    method: 'csv_reference',
    matched_name: best ? best.dish_name : null,
    score: best ? best.score : 0,
    quantity,
    prediction: confident
      ? {
          calories: Math.round(best.calories),
          protein: Math.round(best.protein),
          carbs: Math.round(best.carbs),
          fats: Math.round(best.fats),
          fiber: Math.round(best.fiber),
        }
      : null,
    matches,
  };
}

module.exports = { predictNutrition, parseQuantity };
