const { Pool } = require('pg');
const env = require('./env');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: env.databaseUrl,
  // In production behind managed Postgres (RDS/Railway/Supabase) this
  // is usually required. Set PGSSLMODE via DATABASE_URL if self-hosting.
  ssl: env.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  // Idle client errors — log, don't crash the whole process.
  logger.error('Unexpected error on idle Postgres client', { error: err.message });
});

/**
 * ALWAYS use this helper (or pool.query with $1,$2 placeholders) for
 * any query that includes user input. NEVER build SQL by string
 * concatenation or template literals with variables — that is the
 * #1 way this "secure" backend would stop being secure.
 *
 * Correct:   query('SELECT * FROM users WHERE email = $1', [email])
 * NEVER DO:  query(`SELECT * FROM users WHERE email = '${email}'`)
 */
async function query(text, params = []) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 500) {
    logger.warn('Slow query', { text, duration });
  }
  return res;
}

async function getClient() {
  // Use this for multi-statement transactions:
  // const client = await getClient();
  // try { await client.query('BEGIN'); ... await client.query('COMMIT'); }
  // catch (e) { await client.query('ROLLBACK'); throw e; }
  // finally { client.release(); }
  return pool.connect();
}

module.exports = { pool, query, getClient };
