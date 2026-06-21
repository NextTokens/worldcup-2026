import { cacheGet, cacheSet } from '@/lib/cache';
import type { AppMatch, AppLiveMatch } from '@/lib/data/provider';
import { getEspnLive } from './espn';

/** A simple monotonic-ish sequence used to invalidate the AI summary cache. */
export function liveSeq(live: AppLiveMatch): number {
  return live.events.length;
}

/**
 * Live match state via the configured provider (Path A = ESPN). Short-cached.
 * Returns null if unavailable (provider down, no match found, or pre-match).
 */
export async function getLiveMatch(match: AppMatch): Promise<AppLiveMatch | null> {
  const provider = process.env.LIVE_PROVIDER ?? 'espn';
  if (provider !== 'espn') return null; // Path B (api-football) not wired

  const key = `live:${match.id}`;
  const cached = await cacheGet<AppLiveMatch>(key);
  if (cached) return cached;

  const live = await getEspnLive(match);
  if (live) await cacheSet(key, live, 15);
  return live;
}
