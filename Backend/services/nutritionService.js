const axios = require('axios');

const API_NINJAS_KEY = process.env.API_NINJAS_KEY;

async function getNutrition(query) {
  const response = await axios.get('https://api.api-ninjas.com/v1/nutrition', {
    params: { query },
    headers: { 'X-Api-Key': API_NINJAS_KEY },
    timeout: 5000, // avoid hanging the request if API Ninjas is slow/unreachable
  });
  return response.data;
}

module.exports = { getNutrition };
