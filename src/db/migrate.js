require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const sql = fs.readFileSync(path.join(__dirname, 'migrations/001_init.sql'), 'utf8');
  await client.query(sql);
  console.log('Migration applied successfully.');
  await client.end();
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
