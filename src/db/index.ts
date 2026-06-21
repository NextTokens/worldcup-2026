import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Drizzle client over a postgres-js connection pool.
 * Lazily created so importing the schema (e.g. in drizzle-kit or tests) never
 * forces a DB connection. Use `getDb()` from server code.
 */
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  const client = postgres(url, { prepare: false });
  _db = drizzle(client, { schema, casing: 'snake_case' });
  return _db;
}

export { schema };
