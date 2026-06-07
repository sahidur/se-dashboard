// One-time utility: sets up the 'bep' schema in the DigitalOcean managed DB.
// Run with env vars set:
//   DB_HOST=... DB_PORT=... DB_USERNAME=... DB_PASSWORD=... DB_DATABASE=... node fix-permissions.js
const { Client } = require('pg');

const client = new Client({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  user:     process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || 'bep_se',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
});

if (!process.env.DB_PASSWORD) {
  console.error('Error: DB_PASSWORD environment variable is required.');
  console.error('Usage: DB_HOST=... DB_PORT=... DB_USERNAME=... DB_PASSWORD=... DB_DATABASE=... node fix-permissions.js');
  process.exit(1);
}

(async () => {
  await client.connect();
  console.log('Connected!');

  // Create a schema owned by bep_se_admin
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS bep AUTHORIZATION bep_se_admin');
    console.log('CREATE SCHEMA bep succeeded');
  } catch (e) {
    console.log('CREATE SCHEMA bep failed:', e.message);
  }

  // Set search_path so this schema is the default
  try {
    await client.query("ALTER ROLE bep_se_admin SET search_path TO bep, public");
    console.log('ALTER ROLE search_path succeeded');
  } catch (e) {
    console.log('ALTER ROLE search_path failed:', e.message);
  }

  // Verify we can create objects in the new schema
  try {
    await client.query("SET search_path TO bep, public");
    await client.query("CREATE TYPE bep.test_enum AS ENUM('a', 'b')");
    console.log('CREATE TYPE in bep schema succeeded');
    await client.query('DROP TYPE IF EXISTS bep.test_enum');
    console.log('DROP TYPE succeeded');
  } catch (e) {
    console.log('CREATE TYPE test failed:', e.message);
  }

  await client.end();
  console.log('Done');
})().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
