const axios = require('axios');

const SPOONACULAR_BASE_URL = 'https://api.spoonacular.com';

class SpoonacularService {
  constructor() {
    this.apiKey = process.env.SPOONACULAR_API_KEY;
    if (!this.apiKey) {
      console.warn('SPOONACULAR_API_KEY is not set. Nutrition lookup will fail.');
    }
  }

  async guessNutrition(foodQuery) {
    if (!this.apiKey) {
      throw new Error('Spoonacular API key is not configured.');
    }

    const parsed = this._parseQuery(foodQuery);

    let lastError = null;
    const queriesToTry = [];

    // Determine strategies based on query structure
    const hasAmount = parsed.amount !== 1;
    const hasUnit = !!parsed.unit;
    const hasEmbeddedIngredient = parsed.recipeName !== parsed.ingredientName && parsed.recipeName !== foodQuery;

    if (hasAmount || hasUnit) {
      // Queries with amounts: e.g. "4 eggs", "250g chicken", "Chicken Biryani with 250g chicken"

      if (hasEmbeddedIngredient) {
        // "Chicken Biryani with 250g chicken" → try recipe name first, then ingredient
        queriesToTry.push({ type: 'recipe', query: parsed.recipeName });
        // Also try first word of recipe name for misspellings (e.g. "chicken briyani" → "chicken")
        const firstRecipeWord = parsed.recipeName.split(/\s+/)[0].toLowerCase();
        if (firstRecipeWord !== parsed.recipeName.toLowerCase()) {
          queriesToTry.push({ type: 'recipe', query: firstRecipeWord });
        }
        queriesToTry.push({ type: 'ingredient', parsed });
      } else {
        // "4 eggs", "250g chicken" → try ingredient first
        queriesToTry.push({ type: 'ingredient', parsed });
        queriesToTry.push({ type: 'recipe', query: foodQuery });
      }
    } else {
      // Plain queries: "eggs", "banana", "Chicken Biryani"
      queriesToTry.push({ type: 'recipe', query: parsed.recipeName });
      queriesToTry.push({ type: 'ingredient', parsed });
    }

    for (const attempt of queriesToTry) {
      try {
        let result = null;
        if (attempt.type === 'recipe') {
          result = await this._lookupByRecipe(attempt.query);
        } else {
          result = await this._lookupByIngredient(attempt.parsed, foodQuery);
        }
        if (result) return result;
      } catch (err) {
        if (this._isApiError(err)) throw err;
        lastError = err;
      }
    }

    // Fallback: for multi-word queries that failed everywhere,
    // try the first word as a recipe (e.g. "chicken" from "chicken briyani")
    // or as an ingredient with default serving size (e.g. "bread" from "bread omelette")
    const words = foodQuery.trim().split(/\s+/);
    if (words.length > 1) {
      const firstWord = words[0].toLowerCase();

      // Try first word as recipe title first
      try {
        const result = await this._lookupByRecipe(firstWord);
        if (result) return result;
      } catch (err) {
        if (this._isApiError(err)) throw err;
        lastError = err;
      }

      // Try first word as ingredient with default serving (amount=1)
      const fallbackParsed = { amount: 1, unit: '', ingredientName: firstWord, recipeName: firstWord };
      try {
        const result = await this._lookupByIngredient(fallbackParsed, foodQuery);
        if (result) return result;
      } catch (err) {
        if (this._isApiError(err)) throw err;
        lastError = err;
      }
    }

    if (lastError && lastError.message) {
      throw lastError;
    }
    throw new Error(`Nutrition information is unavailable for "${foodQuery}".`);
  }

  _isApiError(err) {
    const msg = err.message || '';
    return msg.includes('temporarily unavailable') ||
           msg.includes('Too many requests') ||
           msg.includes('timed out') ||
           msg.includes('internet connection') ||
           msg.includes('unexpected error');
  }

  async _lookupByIngredient(parsed, foodQuery) {
    const ingredientId = await this._searchIngredient(parsed.ingredientName);
    if (!ingredientId) return null;

    const nutritionData = await this._getIngredientNutrition(
      ingredientId,
      parsed.amount,
      parsed.unit
    );

    return this._formatIngredientResponse(nutritionData, foodQuery);
  }

  async _lookupByRecipe(foodQuery) {
    try {
      const response = await axios.get(`${SPOONACULAR_BASE_URL}/recipes/guessNutrition`, {
        params: { apiKey: this.apiKey, title: foodQuery },
        timeout: 8000,
      });

      const data = response.data;
      const extract = (key) => {
        if (data[key] && typeof data[key].value === 'number') {
          return parseFloat(data[key].value.toFixed(1));
        }
        return null;
      };

      const result = {
        food: foodQuery,
        calories: extract('calories'),
        protein: extract('protein'),
        fat: extract('fat'),
        carbohydrates: extract('carbs'),
        fiber: extract('fiber'),
        sugar: extract('sugar'),
        sodium: extract('sodium'),
      };

      if (!result.calories && !result.protein && !result.fat) {
        return null;
      }
      return result;
    } catch (err) {
      if (err.response?.status === 404) return null;
      if (err.response?.status === 402 || err.response?.status === 401) {
        throw new Error('Nutrition service is temporarily unavailable. Please try again later.');
      }
      if (err.response?.status === 429) {
        throw new Error('Too many requests. Please wait a moment before trying again.');
      }
      if (err.code === 'ECONNABORTED') {
        throw new Error('Nutrition lookup timed out. Please try again.');
      }
      if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
        throw new Error('Unable to connect to nutrition service. Check your internet connection.');
      }
      return null;
    }
  }

  _parseQuery(query) {
    const trimmed = query.trim();
    const unitPattern = '(?:g|grams?|kg|kilograms?|ml|milliliters?|oz|ounces?|lbs?|pounds?|cups?|tablespoons?|tbsp|teaspoons?|tsp|servings?|slices?|pieces?|items?)';

    // Normalize unit abbreviations
    const normalizeUnit = (raw) => {
      const u = raw.toLowerCase();
      if (/^g(rams?)?$/.test(u)) return 'g';
      if (/^kg|kilograms?/.test(u)) return 'g';
      if (/^ml|milliliters?/.test(u)) return 'ml';
      if (/^oz|ounces?/.test(u)) return 'oz';
      if (/^lbs?|pounds?/.test(u)) return 'lb';
      if (/^cups?/.test(u)) return 'cups';
      if (/^tablespoons?|tbsp/.test(u)) return 'tbsp';
      if (/^teaspoons?|tsp/.test(u)) return 'tsp';
      if (/^servings?/.test(u)) return 'servings';
      if (/^slices?/.test(u)) return 'slices';
      if (/^pieces?/i.test(u)) return 'pieces';
      if (/^items?/i.test(u)) return 'items';
      return '';
    };

    // Case 1: Leading number + optional unit + ingredient
    // e.g. "4 eggs", "250g chicken", "100 g rice"
    const leadMatch = trimmed.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})?\\s*(.+)`, 'i'));
    if (leadMatch) {
      const amount = parseFloat(leadMatch[1]);
      const rawUnit = (leadMatch[2] || '').trim().toLowerCase();
      const ingredientName = (leadMatch[3] || trimmed).trim();
      const unit = rawUnit ? normalizeUnit(rawUnit) : '';
      const finalAmount = /^kg|kilograms?/.test(rawUnit) ? amount * 1000 : amount;
      return { amount: finalAmount, unit, ingredientName, recipeName: ingredientName };
    }

    // Case 2: Number + unit + ingredient embedded in middle/end of phrase
    // e.g. "Chicken Biryani with 250g chicken", "pasta with 100g cheese"
    // Use greedy capture then trim after "and/of/with + number" conjunctions
    const embedMatch = trimmed.match(new RegExp(`(?:(?:with|of|and)\\s+)?(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})\\s+(.+)`, 'i'));
    if (embedMatch) {
      const amount = parseFloat(embedMatch[1]);
      const rawUnit = (embedMatch[2] || '').trim().toLowerCase();
      let rawIngredient = (embedMatch[3] || '').trim();
      // Strip trailing conjunctions with amounts (e.g. "chicken and 100g rice" -> "chicken")
      rawIngredient = rawIngredient.replace(new RegExp(`\\s+(?:and|with|of)\\s+\\d+(?:\\.\\d+)?\\s*(?:${unitPattern})\\s+\\S.*$`, 'i'), '').trim();
      const ingredientName = rawIngredient;
      const unit = normalizeUnit(rawUnit);
      const finalAmount = /^kg|kilograms?/.test(rawUnit) ? amount * 1000 : amount;

      // Extract a shorter recipe name: everything before the matched ingredient detail
      const matchIndex = embedMatch.index;
      let recipeName = typeof matchIndex === 'number' && matchIndex > 0
        ? trimmed.substring(0, matchIndex).trim()
        : '';
      recipeName = recipeName.replace(/\s+(?:with|and|of)\s*$/i, '').trim();
      if (!recipeName) recipeName = ingredientName;

      return { amount: finalAmount, unit, ingredientName, recipeName };
    }

    // Case 3: Just a food name, no amounts
    return { amount: 1, unit: '', ingredientName: trimmed, recipeName: trimmed };
  }

  async _searchIngredient(query) {
    try {
      const response = await axios.get(`${SPOONACULAR_BASE_URL}/food/ingredients/search`, {
        params: { apiKey: this.apiKey, query, number: 1 },
        timeout: 8000,
      });

      const results = response.data?.results;
      if (!results || results.length === 0) return null;

      return results[0].id;
    } catch (err) {
      if (err.response?.status === 402 || err.response?.status === 401) {
        throw new Error('Nutrition service is temporarily unavailable. Please try again later.');
      }
      if (err.response?.status === 429) {
        throw new Error('Too many requests. Please wait a moment before trying again.');
      }
      return null;
    }
  }

  async _getIngredientNutrition(ingredientId, amount, unit) {
    const params = { apiKey: this.apiKey, amount };
    if (unit) params.unit = unit;

    try {
      const response = await axios.get(
        `${SPOONACULAR_BASE_URL}/food/ingredients/${ingredientId}/information`,
        { params, timeout: 8000 }
      );
      return response.data;
    } catch (err) {
      if (err.response?.status === 402 || err.response?.status === 401) {
        throw new Error('Nutrition service is temporarily unavailable. Please try again later.');
      }
      if (err.response?.status === 429) {
        throw new Error('Too many requests. Please wait a moment before trying again.');
      }
      return null;
    }
  }

  _formatIngredientResponse(nutritionData, foodQuery) {
    let nutrientsArray = [];
    if (nutritionData.nutrition?.nutrients && Array.isArray(nutritionData.nutrition.nutrients)) {
      nutrientsArray = nutritionData.nutrition.nutrients;
    } else if (Array.isArray(nutritionData.nutrients)) {
      nutrientsArray = nutritionData.nutrients;
    }

    if (nutrientsArray.length === 0) return null;

    const findNutrient = (name) => {
      const nutrient = nutrientsArray.find(
        (n) => n.name?.toLowerCase() === name.toLowerCase()
      );
      if (nutrient && nutrient.amount != null) {
        return parseFloat(nutrient.amount.toFixed(1));
      }
      return null;
    };

    const result = {
      food: foodQuery,
      calories: findNutrient('calories'),
      protein: findNutrient('protein'),
      fat: findNutrient('fat'),
      carbohydrates: findNutrient('carbohydrates'),
      fiber: findNutrient('fiber'),
      sugar: findNutrient('sugar'),
      sodium: findNutrient('sodium'),
    };

    if (!result.calories && !result.protein && !result.fat) return null;

    return result;
  }
}

module.exports = new SpoonacularService();
