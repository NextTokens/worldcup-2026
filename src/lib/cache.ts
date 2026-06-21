/**
 * Tiny cache: Redis when REDIS_URL is set, in-memory otherwise (ARCHITECTURE.md §6).
 * Used for live match state + generated AI summaries. Degrades gracefully so the
 * app runs with zero infra in dev.
 */

let redis: unknown;
let redisTried = false;
const mem = new Map<string, { v: string; exp: number }>();

async function getRedis(): Promise<{
  get: (k: string) => Promise<string | null>;
  set: (k: string, v: string, mode: string, ttl: number) => Promise<unknown>;
} | null> {
  if (redisTried) return redis as never;
  redisTried = true;
  const url = process.env.REDIS_URL;
  if (!url) {
    redis = null;
    return null;
  }
  try {
    const mod = await import('ioredis');
    const IORedis = mod.default;
    const client = new IORedis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    await client.connect();
    redis = client;
  } catch {
    redis = null;
  }
  return redis as never;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = await getRedis();
  if (r) {
    try {
      const v = await r.get(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      /* fall through to memory */
    }
  }
  const e = mem.get(key);
  if (e && e.exp > Date.now()) return JSON.parse(e.v) as T;
  if (e) mem.delete(key);
  return null;
}

export async function cacheSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  const s = JSON.stringify(value);
  const r = await getRedis();
  if (r) {
    try {
      await r.set(key, s, 'EX', ttlSec);
      return;
    } catch {
      /* fall through to memory */
    }
  }
  mem.set(key, { v: s, exp: Date.now() + ttlSec * 1000 });
}
