const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
});

pool.on('error', (err) => {
  console.error('[inquest-db] Unexpected error on idle client', err.message);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = { query, pool };
