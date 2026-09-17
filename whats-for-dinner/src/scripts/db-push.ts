/**
 * Apply the schema to DATABASE_URL and exit. Useful in CI or before a first
 * deploy; the app also does this lazily on its first request.
 */
import postgres from 'postgres';
import { SCHEMA_SQL } from '../lib/schema';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const sql = postgres(url, {
  ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : 'require',
});

try {
  await sql.unsafe(SCHEMA_SQL);
  console.log('Schema applied.');
} catch (err) {
  console.error('Failed to apply schema:', err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
