const pool = require('../config/db');

/**
 * GET /api/food/search?q=idli
 * Returns up to 10 matching foods from food_nutrition_reference for the
 * Food Tracker's live autocomplete. Empty/short queries short-circuit
 * without hitting the DB.
 */
const searchFoodReference = async (req, res) => {
  const q = (req.query.q || '').trim();

  if (q.length < 2) {
    return res.json([]);
  }

  try {
    const result = await pool.query(
      `SELECT id, food_name, serving_quantity, serving_grams,
              calories_kcal, protein_g, carbohydrates_g, fat_g
       FROM food_nutrition_reference
       WHERE food_name ILIKE $1
       ORDER BY
         CASE WHEN food_name ILIKE $2 THEN 0 ELSE 1 END, -- exact-prefix matches first
         food_name ASC
       LIMIT 10`,
      [`%${q}%`, `${q}%`]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('Food reference search error:', err);
    return res.status(500).json({ success: false, message: 'Failed to search food reference data.' });
  }
};

// Allow-lists for the list endpoint's sortBy/sortDir params — these are
// interpolated into the ORDER BY clause below, so they must never come
// directly from user input.
const SORTABLE_COLUMNS = new Set([
  'food_name',
  'calories_kcal',
  'protein_g',
  'carbohydrates_g',
  'fat_g',
]);
const SORT_DIRECTIONS = new Set(['asc', 'desc']);

/**
 * GET /api/food/reference?search=&sortBy=&sortDir=&page=&pageSize=
 * Paginated/sortable/searchable browse of the full food_nutrition_reference
 * table for the Food Database page. Returns only the lightweight list
 * columns — full detail is fetched per-row via getFoodReferenceById.
 */
const listFoodReference = async (req, res) => {
  const search = (req.query.search || '').trim();

  const sortBy = SORTABLE_COLUMNS.has(req.query.sortBy) ? req.query.sortBy : 'food_name';
  const sortDir = SORT_DIRECTIONS.has((req.query.sortDir || '').toLowerCase())
    ? req.query.sortDir.toLowerCase()
    : 'asc';

  let page = parseInt(req.query.page, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;

  let pageSize = parseInt(req.query.pageSize, 10);
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = 20;
  pageSize = Math.min(pageSize, 100);

  const offset = (page - 1) * pageSize;

  try {
    const values = [];
    let whereClause = '';
    if (search) {
      values.push(`%${search}%`);
      whereClause = `WHERE food_name ILIKE $${values.length}`;
    }

    values.push(pageSize);
    const limitParam = `$${values.length}`;
    values.push(offset);
    const offsetParam = `$${values.length}`;

    // sortBy/sortDir are validated against allow-lists above, so it's safe
    // to interpolate them directly — they never come straight from req.query.
    const result = await pool.query(
      `SELECT id, food_name, serving_quantity,
              calories_kcal, protein_g, carbohydrates_g, fat_g,
              COUNT(*) OVER() AS total_count
       FROM food_nutrition_reference
       ${whereClause}
       ORDER BY ${sortBy} ${sortDir}
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      values
    );

    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    const results = result.rows.map(({ total_count, ...row }) => row);

    return res.json({
      results,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    console.error('Food reference list error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch food reference data.' });
  }
};

/**
 * GET /api/food/reference/:id
 * Returns the full row (all micronutrient columns) for a single
 * reference food.
 */
const getFoodReferenceById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM food_nutrition_reference WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Food not found.' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Food reference fetch error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch food reference data.' });
  }
};

module.exports = { searchFoodReference, getFoodReferenceById, listFoodReference };
