const spoonacularService = require('../services/spoonacular.service');

const getNutrition = async (req, res) => {
  try {
    const food = (req.query.food || req.body?.food || '').trim();

    if (!food) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a food description. Example: "Chicken Biryani with 250g chicken and 100g rice"',
      });
    }

    if (food.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Food description must be at least 3 characters long.',
      });
    }

    if (food.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Food description is too long. Please use 500 characters or less.',
      });
    }

    const nutritionData = await spoonacularService.guessNutrition(food);

    if (!nutritionData.calories && !nutritionData.protein) {
      return res.status(404).json({
        success: false,
        message: `Nutrition information is unavailable for "${food}". Please try a different description.`,
        food,
      });
    }

    return res.status(200).json({
      success: true,
      data: nutritionData,
    });
  } catch (err) {
    const statusCode = err.message.includes('unavailable') || err.message.includes('try a different')
      ? 404
      : err.message.includes('too many requests')
        ? 429
        : 500;

    return res.status(statusCode).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = { getNutrition };
