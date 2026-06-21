/**
 * Live poller worker (ARCHITECTURE.md §4 + §6).
 *
 * Long-lived Railway service (NOT Railway cron). Every ~15s it finds matches in
 * their live window, pulls live state from the provider (ESPN, Path A), warms the
 * per-locale AI summary cache, and pings /api/revalidate to invalidate the
 * `match:<id>` + `bracket` cache tags. The Next app also fetches on-demand, so the
 * poller is a pre-warmer for scale — the app works without it.
 */
import { getMatches } from '@/lib/data/catalog';
import { getLiveMatch } from '@/lib/live';
import { getMatchSummary } from '@/lib/ai/summary';
import { locales } from '@/i18n/routing';

const POLL_MS = 15_000;
const PRE_WINDOW_MS = 15 * 60 * 1000; // start polling 15 min before kickoff
const POST_WINDOW_MS = 3 * 60 * 60 * 1000; // keep polling up to 3h after kickoff
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pingRevalidate(matchId: string): Promise<void> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return;
  try {
    await fetch(`${SITE}/api/revalidate?secret=${encodeURIComponent(secret)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tags: [`match:${matchId}`, 'bracket'] }),
    });
  } catch {
    /* best effort */
  }
}

async function tick(): Promise<void> {
  const matches = await getMatches();
  const now = Date.now();
  const liveWindow = matches.filter((m) => {
    if (m.status === 'live' || m.status === 'paused') return true;
    const k = new Date(m.kickoffUtc).getTime();
    return now > k - PRE_WINDOW_MS && now < k + POST_WINDOW_MS;
  });

  if (liveWindow.length === 0) {
    console.log(`[poller] no matches in window @ ${new Date().toISOString()}`);
    return;
  }

  for (const m of liveWindow) {
    const live = await getLiveMatch(m);
    if (!live) continue;
    for (const loc of locales) await getMatchSummary(m, live, loc);
    await pingRevalidate(m.id);
    console.log(
      `[poller] ${m.id} ${live.homeScore ?? '-'}-${live.awayScore ?? '-'} ${live.status} (${live.events.length} ev)`,
    );
  }
}

async function main(): Promise<void> {
  console.log(`[poller] starting; provider=${process.env.LIVE_PROVIDER ?? 'espn'}, poll=${POLL_MS}ms`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await tick();
    } catch (err) {
      console.error('[poller] tick error', err);
    }
    await sleep(POLL_MS);
  }
}

void main();

export {};
