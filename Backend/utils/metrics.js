// ============================================================
// utils/metrics.js  –  Centralised fitness calculation logic
// ============================================================

/**
 * calculateMetrics
 *
 * All calorie targets already include the ±500 kcal adjustment
 * for weight_loss / weight_gain goals.
 * The 7,700 kcal/kg rule is used everywhere for weight estimation.
 *
 * @param {number|string} weight   – current body weight in kg
 * @param {number|string} height   – height in cm
 * @param {number|string} age      – age in years
 * @param {string}        gender   – 'male' | 'female'
 * @param {number|string} activity_level – 1-10
 * @param {string}        goal     – 'weight_loss' | 'weight_gain' | 'maintain'
 * @param {boolean}       gym_status
 * @returns {{ bmr, maintenance_calories, daily_calories, daily_protein }}
 */
const calculateMetrics = (weight, height, age, gender, activity_level, goal, gym_status) => {
  const w  = parseFloat(weight)   || 0;
  const h  = parseFloat(height)   || 0;
  const a  = parseInt(age)        || 0;
  const al = parseInt(activity_level) || 5;

  // Mifflin-St Jeor BMR
  let bmr;
  if (gender === 'male') {
    bmr = 10 * w + 6.25 * h - 5 * a + 5;
  } else {
    bmr = 10 * w + 6.25 * h - 5 * a - 161;
  }

  // TDEE multiplier based on activity level (1-10 scale)
  let multiplier = 1.2;
  if      (al <= 3) multiplier = 1.2;
  else if (al <= 6) multiplier = 1.55;
  else              multiplier = 1.9;

  const maintenance_calories = Math.round(bmr * multiplier);

  // Target calories already include the ±500 adjustment.
  // Nothing else should add/subtract 500 again downstream.
  let daily_calories = maintenance_calories;
  if      (goal === 'weight_loss') daily_calories -= 500;
  else if (goal === 'weight_gain') daily_calories += 500;

  // Protein target: ~1 g per kg baseline, scaled by activity
  const daily_protein = Math.round(w * (10 + al) / 10);

  // BMI
  const heightM = h / 100;
  const bmi = heightM > 0 ? parseFloat((w / (heightM * heightM)).toFixed(1)) : null;

  return {
    bmr:                  Math.round(bmr),
    maintenance_calories,
    daily_calories:       Math.round(daily_calories),
    daily_protein,
    bmi,
  };
};

module.exports = { calculateMetrics };
