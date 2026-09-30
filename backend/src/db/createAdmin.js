require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const env = require('../config/env');

async function run() {
  const [fullName, phone, password] = process.argv.slice(2);
  if (!fullName || !phone || !password) {
    console.error('Usage: node src/db/createAdmin.js "<full name>" "<10-digit phone>" "<password>"');
    process.exit(1);
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const existing = await client.query('SELECT id FROM users WHERE phone = $1', [phone]);
  if (existing.rows.length > 0) {
    console.error('A user with this phone number already exists.');
    await client.end();
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(password, env.bcryptSaltRounds);
  const result = await client.query(
    `INSERT INTO users (full_name, phone, password_hash, role)
     VALUES ($1, $2, $3, 'admin') RETURNING id, full_name, phone, role`,
    [fullName, phone, passwordHash]
  );
  console.log('Admin account created:', result.rows[0]);
  await client.end();
}

run().catch((err) => { console.error('Failed:', err.message); process.exit(1); });
