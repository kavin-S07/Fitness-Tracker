const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const schema = require('./schema');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const db = drizzle(pool, { schema });

pool.query('SELECT NOW()')
  .then(() => console.log('✅ DB Connected (Drizzle)'))
  .catch(err => console.error('❌ DB Error:', err));

module.exports = { db, pool };
