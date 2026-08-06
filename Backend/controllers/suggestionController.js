const pool = require('../config/db');

const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

// Snacks get a lower absolute protein floor than full meals.
// Used internally by the meal suggestion logic.
// Returns the minimum protein amount a meal combo should have, based on meal type.
function proteinFloorFor(mealType) {
  return mealType === 'snack' ? 15 : 20;
}

// Used internally when handling meal suggestion requests.
// Converts a comma-separated list of combo IDs from the query string into an array of numbers.
function parseExclude(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n));
}

// Used internally after a meal combo is chosen (suggested or random).
// Fetches the individual food items that make up a given meal combination.
async function fetchItems(combinationId) {
  const result = await pool.query(
    `SELECT
       mci.id,
       mci.food_reference_id,
       mci.quantity_multiplier,
       fnr.food_name,
       fnr.serving_quantity,
       fnr.calories_kcal,
       fnr.protein_g,
       fnr.carbohydrates_g,
       fnr.fat_g
     FROM meal_combination_items mci
     JOIN food_nutrition_reference fnr ON fnr.id = mci.food_reference_id
     WHERE mci.combination_id = $1
     ORDER BY mci.id ASC`,
    [combinationId]
  );
  return result.rows;
}

// ============================================================
// GET /api/food/suggest?mealType=&targetCalories=&targetProtein=&exclude=
//
// Returns the single best-matching combo for the given meal type and
// remaining calorie/protein targets, plus its component items. Widens
// the calorie window once if nothing matches, before giving up.
// ============================================================
// Used when the user clicks "Suggest a meal" on the Food page.
// Finds the best-matching pre-built meal combo for the user's remaining calorie/protein targets.
const suggestMeal = async (req, res) => {
  const mealType = String(req.query.mealType || '').toLowerCase();
  const targetCalories = parseFloat(req.query.targetCalories);
  const targetProtein = parseFloat(req.query.targetProtein);
  const excludeIds = parseExclude(req.query.exclude);

  if (!VALID_MEAL_TYPES.includes(mealType)) {
    return res.status(400).json({
      success: false,
      message: `mealType must be one of: ${VALID_MEAL_TYPES.join(', ')}.`,
    });
  }
  if (!Number.isFinite(targetCalories) || !Number.isFinite(targetProtein)) {
    return res.status(400).json({
      success: false,
      message: 'targetCalories and targetProtein must be numbers.',
    });
  }

  const proteinFloor = proteinFloorFor(mealType);

  try {
    // First pass: ±20% calorie window.
    let combo = await pool.query(
      `SELECT *
       FROM meal_combinations
       WHERE meal_type = $1
         AND total_protein >= GREATEST($2, $3 * 0.7)
         AND total_calories BETWEEN $4 AND $5
         AND id <> ALL($6::int[])
       ORDER BY ABS(total_calories - $7) + ABS(total_protein - $3) ASC
       LIMIT 1`,
      [
        mealType,
        proteinFloor,
        targetProtein,
        targetCalories * 0.8,
        targetCalories * 1.2,
        excludeIds,
        targetCalories,
      ]
    );

    // Second pass: widen the calorie window once (±35%) before giving up.
    if (combo.rows.length === 0) {
      combo = await pool.query(
        `SELECT *
         FROM meal_combinations
         WHERE meal_type = $1
           AND total_protein >= GREATEST($2, $3 * 0.7)
           AND total_calories BETWEEN $4 AND $5
           AND id <> ALL($6::int[])
         ORDER BY ABS(total_calories - $7) + ABS(total_protein - $3) ASC
         LIMIT 1`,
        [
          mealType,
          proteinFloor,
          targetProtein,
          targetCalories * 0.65,
          targetCalories * 1.35,
          excludeIds,
          targetCalories,
        ]
      );
    }

    if (combo.rows.length === 0) {
      return res.json({ success: true, combination: null, items: [] });
    }

    const combination = combo.rows[0];
    const items = await fetchItems(combination.id);

    return res.json({ success: true, combination, items });
  } catch (err) {
    console.error('Suggest meal error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ============================================================
// GET /api/food/random?mealType=
//
// Returns one uniformly random combo for the meal type, ignoring
// calorie/protein targets entirely — a "surprise me" option.
// ============================================================
// Used when the user clicks "Surprise me" / random meal option on the Food page.
// Returns a completely random meal combo for the chosen meal type, ignoring calorie/protein targets.
const randomMeal = async (req, res) => {
  const mealType = String(req.query.mealType || '').toLowerCase();

  if (!VALID_MEAL_TYPES.includes(mealType)) {
    return res.status(400).json({
      success: false,
      message: `mealType must be one of: ${VALID_MEAL_TYPES.join(', ')}.`,
    });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM meal_combinations WHERE meal_type = $1 ORDER BY RANDOM() LIMIT 1`,
      [mealType]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, combination: null, items: [] });
    }

    const combination = result.rows[0];
    const items = await fetchItems(combination.id);

    return res.json({ success: true, combination, items });
  } catch (err) {
    console.error('Random meal error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { suggestMeal, randomMeal };
