import type { AppMatch, AppLiveMatch, AppLiveEvent, MatchStatus } from '@/lib/data/provider';

/**
 * ESPN hidden JSON API — free, unofficial live provider (Path A, ARCHITECTURE.md §0).
 * Personal/non-commercial. Best-effort: every failure degrades to null.
 * Our matches carry football-data/OpenFootball ids, so we resolve the ESPN event
 * by date + team-name match against ESPN's scoreboard, then read its summary.
 */

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
}

function dateParam(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, ''); // YYYYMMDD
}

function mapStatus(state?: string): MatchStatus {
  if (state === 'in') return 'live';
  if (state === 'post') return 'finished';
  return 'scheduled';
}

function mapEventType(text?: string): AppLiveEvent['type'] {
  const s = (text ?? '').toLowerCase();
  if (s.includes('own goal')) return 'own_goal';
  if (s.includes('penalty') && s.includes('miss')) return 'penalty_missed';
  if (s.includes('penalty')) return 'penalty_goal';
  if (s.includes('goal')) return 'goal';
  if (s.includes('yellow') && s.includes('red')) return 'yellow_red';
  if (s.includes('red')) return 'red';
  if (s.includes('yellow') || s.includes('caution')) return 'yellow';
  if (s.includes('substitution') || s.includes('sub')) return 'substitution';
  return 'var';
}

function parseMinute(clock?: string | null): number | null {
  if (!clock) return null;
  const m = /(\d{1,3})/.exec(clock);
  return m ? parseInt(m[1], 10) : null;
}

async function findEventId(match: AppMatch): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/scoreboard?dates=${dateParam(match.kickoffUtc)}`, {
      next: { revalidate: 30, tags: ['espn'] },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { events?: unknown[] };
    const hn = norm(match.home?.name ?? '');
    const an = norm(match.away?.name ?? '');
    if (!hn || !an) return null;
    for (const ev of data.events ?? []) {
      const e = ev as { id?: string | number; competitions?: { competitors?: unknown[] }[] };
      const comps = e.competitions?.[0]?.competitors ?? [];
      const names = comps.map((c) => {
        const t = (c as { team?: { displayName?: string; shortDisplayName?: string } }).team;
        return norm(t?.displayName ?? t?.shortDisplayName ?? '');
      });
      const hit = (q: string) => names.some((n) => n && (n.includes(q) || q.includes(n)));
      if (hit(hn) && hit(an)) return String(e.id);
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function getEspnLive(match: AppMatch): Promise<AppLiveMatch | null> {
  const eventId = await findEventId(match);
  if (!eventId) return null;
  try {
    const res = await fetch(`${BASE}/summary?event=${eventId}`, {
      next: { revalidate: 15, tags: ['espn'] },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      header?: {
        competitions?: {
          status?: { type?: { state?: string }; displayClock?: string; period?: number };
          competitors?: { homeAway?: string; score?: string }[];
        }[];
      };
      keyEvents?: unknown[];
    };
    const comp = data.header?.competitions?.[0];
    const status = mapStatus(comp?.status?.type?.state);
    const minute = parseMinute(comp?.status?.displayClock) ?? comp?.status?.period ?? null;
    const competitors = comp?.competitors ?? [];
    const score = (side: string) => {
      const c = competitors.find((x) => x.homeAway === side);
      return c?.score != null ? parseInt(c.score, 10) : null;
    };

    const events: AppLiveEvent[] = (data.keyEvents ?? []).map((raw, i) => {
      const ev = raw as {
        id?: string | number;
        type?: { text?: string };
        text?: string;
        clock?: { displayValue?: string };
        team?: { id?: string | number };
        athletesInvolved?: { displayName?: string }[];
      };
      return {
        eventId: String(ev.id ?? i),
        minute: parseMinute(ev.clock?.displayValue),
        type: mapEventType(ev.type?.text ?? ev.text),
        teamId: ev.team?.id != null ? String(ev.team.id) : null,
        player: ev.athletesInvolved?.[0]?.displayName ?? null,
        scoreAfterHome: null,
        scoreAfterAway: null,
      };
    });

    return {
      matchId: match.id,
      status,
      minute,
      homeScore: score('home'),
      awayScore: score('away'),
      events,
    };
  } catch {
    return null;
  }
}
