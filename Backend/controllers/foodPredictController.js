const { predictNutrition } = require('../services/foodMatchService');

const predictFood = async (req, res) => {
  const q = req.query.q || req.query.food_name;

  if (!q || !q.trim()) {
    return res.status(400).json({ success: false, message: 'Query param "q" is required.' });
  }

  try {
    const result = await predictNutrition(q.trim());

    if (result.confident && result.prediction) {
      return res.json({
        success: true,
        query: q,
        confident: true,
        method: result.method,
        matched_name: result.matched_name,
        score: result.score,
        quantity: result.quantity,
        prediction: result.prediction,
        matches: result.matches,
      });
    }

    return res.json({
      success: true,
      query: q,
      confident: false,
      method: result.method,
      matched_name: result.matched_name,
      score: result.score,
      quantity: result.quantity,
      prediction: null,
      matches: result.matches,
    });
  } catch (err) {
    console.error('Predict food error:', err);
    res.status(500).json({ success: false, message: 'Server error.', detail: err.message });
  }
};

module.exports = { predictFood };
