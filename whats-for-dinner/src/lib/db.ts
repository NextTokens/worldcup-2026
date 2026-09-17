import 'server-only';
import postgres from 'postgres';
import { SCHEMA_SQL } from './schema';

/**
 * Single Postgres pool, cached across dev hot-reloads.
 *
 * Railway injects DATABASE_URL when you attach a Postgres plugin; that is the
 * only piece of infrastructure this app needs.
 */

const globalForDb = globalThis as unknown as {
  __wfdSql?: postgres.Sql;
  __wfdSchemaReady?: Promise<void>;
};

export class MissingDatabaseError extends Error {
  constructor() {
    super('DATABASE_URL is not set. Attach a Postgres database and redeploy.');
    this.name = 'MissingDatabaseError';
  }
}

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getSql(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new MissingDatabaseError();
  if (!globalForDb.__wfdSql) {
    globalForDb.__wfdSql = postgres(url, {
      max: Number(process.env.PGPOOL_MAX ?? 5),
      idle_timeout: 20,
      // Railway's internal network serves TLS with its own chain.
      ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : 'require',
      transform: { undefined: null },
    });
  }
  return globalForDb.__wfdSql;
}

/**
 * Apply the schema once per process. Every statement is `if not exists`, so
 * this doubles as the migration story for a single-household deployment.
 */
export function ensureSchema(): Promise<void> {
  if (!globalForDb.__wfdSchemaReady) {
    globalForDb.__wfdSchemaReady = (async () => {
      const sql = getSql();
      await sql.unsafe(SCHEMA_SQL);
    })().catch((err) => {
      // Let the next request retry rather than caching a failure forever.
      globalForDb.__wfdSchemaReady = undefined;
      throw err;
    });
  }
  return globalForDb.__wfdSchemaReady;
}

/** Schema-ready pool. Every repo function goes through this. */
export async function db(): Promise<postgres.Sql> {
  await ensureSchema();
  return getSql();
}
