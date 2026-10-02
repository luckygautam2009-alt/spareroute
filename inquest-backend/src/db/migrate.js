#!/usr/bin/env node
/**
 * Inquest migration runner.
 *
 * Usage:
 *   node src/db/migrate.js            – apply all pending migrations
 *   node src/db/migrate.js --baseline – record all migration files as applied
 *                                       WITHOUT running them (for databases that
 *                                       already have the tables)
 *
 * Modelled on backend/src/db/migrate.js with an added --baseline flag.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const isBaseline = process.argv.includes('--baseline');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Ensure the tracking table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const appliedResult = await client.query('SELECT filename FROM schema_migrations');
  const applied = new Set(appliedResult.rows.map((r) => r.filename));

  if (isBaseline) {
    // --baseline: record all files as applied without executing them.
    // Safe to run on databases that already have the tables.
    let recorded = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Already recorded (baseline): ${file}`);
        continue;
      }
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      console.log(`Baselined (recorded without running): ${file}`);
      recorded++;
    }
    console.log(`Baseline complete. ${recorded} file(s) recorded.`);
    await client.end();
    return;
  }

  // Normal mode: apply pending migrations inside per-file transactions
  let applied_count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Skipping already-applied migration: ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Applying migration: ${file}`);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied: ${file}`);
      applied_count++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Failed to apply ${file}: ${err.message}`);
      await client.end();
      process.exit(1);
    }
  }

  console.log(`All migrations up to date. ${applied_count} new migration(s) applied.`);
  await client.end();
}

run().catch((err) => {
  console.error('Migration runner failed:', err.message);
  process.exit(1);
});
