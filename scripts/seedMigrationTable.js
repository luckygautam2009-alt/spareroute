require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await client.query(
    `INSERT INTO schema_migrations (filename) VALUES ('001_init.sql') ON CONFLICT DO NOTHING`
  );
  console.log('Marked 001_init.sql as already applied.');
  await client.end();
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
