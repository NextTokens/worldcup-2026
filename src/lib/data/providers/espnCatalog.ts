import type {
  MatchDataProvider,
  AppMatch,
  AppGroupStanding,
  AppStandingRow,
  AppTeamRef,
  Round,
  MatchStatus,
} from '../provider';

/**
 * ESPN hidden JSON API — the single, keyless data source for the app.
 * One source for fixtures, live scores, AND current group standings (verified
 * to return real 12-group WC2026 data with no key). Unofficial / personal use.
 */

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
const STANDINGS = 'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings';
const HEADERS = { 'User-Agent': 'worldcup-2026/0.1' };

async function json<T>(url: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, next: { revalidate, tags: ['espn'] } });
    if (!res.ok) {
      console.error(`[espn] ${res.status} ${res.statusText} ${url}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[espn] fetch error ${url}: ${String(err)}`);
    return null;
  }
}

function groupLetter(name: string | undefined): string | null {
  if (!name) return null;
  const m = /([A-L])\s*$/.exec(name.toUpperCase());
  return m ? m[1] : null;
}

function mapState(state: string | undefined): MatchStatus {
  if (state === 'in') return 'live';
  if (state === 'post') return 'finished';
  return 'scheduled';
}

function roundForDate(iso: string): Round {
  const d = iso.slice(0, 10);
  if (d <= '2026-06-27') return 'group';
  if (d <= '2026-07-03') return 'R32';
  if (d <= '2026-07-07') return 'R16';
  if (d <= '2026-07-11') return 'QF';
  if (d <= '2026-07-15') return 'SF';
  if (d === '2026-07-18') return '3P';
  return 'F';
}

interface EspnTeam {
  id?: string | number;
  displayName?: string;
  abbreviation?: string;
  logo?: string;
  logos?: { href?: string }[];
}
interface EspnStat {
  name?: string;
  value?: number;
  displayValue?: string;
}

function logoOf(t: EspnTeam | undefined): string | null {
  return t?.logos?.[0]?.href ?? t?.logo ?? null;
}

function teamRef(t: EspnTeam | undefined): AppTeamRef | null {
  if (!t || t.id == null) return null;
  return {
    id: String(t.id),
    name: t.displayName ?? 'TBD',
    fifaCode: t.abbreviation ?? null,
    crestUrl: logoOf(t),
  };
}

function statNum(stats: EspnStat[], name: string): number {
  const s = stats.find((x) => x.name === name);
  if (!s) return 0;
  if (typeof s.value === 'number') return s.value;
  return parseInt(String(s.displayValue ?? '0').replace('+', ''), 10) || 0;
}

export class EspnCatalogProvider implements MatchDataProvider {
  readonly name = 'espn';
  readonly capabilities = {
    fixtures: true,
    standings: true,
    squads: false,
    live: true,
    events: true,
    lineups: false,
  };

  async getStandings(): Promise<AppGroupStanding[]> {
    const data = await json<{
      children?: {
        name?: string;
        standings?: { entries?: { team?: EspnTeam; stats?: EspnStat[] }[] };
      }[];
    }>(STANDINGS, 120);
    if (!data?.children) return [];

    return data.children
      .map((g) => {
        const letter = groupLetter(g.name) ?? '?';
        const rows: AppStandingRow[] = (g.standings?.entries ?? [])
          .map((e) => {
            const stats = e.stats ?? [];
            return {
              teamId: e.team?.id != null ? String(e.team.id) : null,
              teamName: e.team?.displayName ?? 'TBD',
              crestUrl: logoOf(e.team),
              played: statNum(stats, 'gamesPlayed'),
              won: statNum(stats, 'wins'),
              drawn: statNum(stats, 'ties'),
              lost: statNum(stats, 'losses'),
              goalsFor: statNum(stats, 'pointsFor'),
              goalsAgainst: statNum(stats, 'pointsAgainst'),
              goalDifference: statNum(stats, 'pointDifferential'),
              points: statNum(stats, 'points'),
              rank: statNum(stats, 'rank') || null,
            };
          })
          .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
        return { group: letter, rows };
      })
      .filter((g) => g.group !== '?')
      .sort((a, b) => a.group.localeCompare(b.group));
  }

  async getMatches(): Promise<AppMatch[]> {
    const [data, standings] = await Promise.all([
      json<{
        events?: {
          id?: string | number;
          date?: string;
          competitions?: {
            competitors?: { homeAway?: string; score?: string; team?: EspnTeam }[];
            status?: { type?: { state?: string } };
            venue?: { fullName?: string; address?: { city?: string } };
          }[];
        }[];
      }>(`${BASE}/scoreboard?dates=20260611-20260719&limit=300`, 120),
      this.getStandings(),
    ]);
    if (!data?.events) return [];

    // teamId -> group, so group-stage matches can carry their group letter.
    const teamGroup = new Map<string, string>();
    for (const g of standings) for (const r of g.rows) if (r.teamId) teamGroup.set(r.teamId, g.group);

    return data.events
      .map((ev) => {
        const comp = ev.competitions?.[0];
        const competitors = comp?.competitors ?? [];
        const home = teamRef(competitors.find((c) => c.homeAway === 'home')?.team);
        const away = teamRef(competitors.find((c) => c.homeAway === 'away')?.team);
        const homeScoreRaw = competitors.find((c) => c.homeAway === 'home')?.score;
        const awayScoreRaw = competitors.find((c) => c.homeAway === 'away')?.score;
        const iso = ev.date ? new Date(ev.date).toISOString() : new Date(0).toISOString();
        const group =
          home?.id && away?.id && teamGroup.get(home.id) === teamGroup.get(away.id)
            ? (teamGroup.get(home.id) ?? null)
            : null;
        return {
          id: String(ev.id),
          matchNumber: null,
          round: roundForDate(iso),
          group,
          kickoffUtc: iso,
          status: mapState(comp?.status?.type?.state),
          home,
          away,
          homeScore: homeScoreRaw != null ? parseInt(homeScoreRaw, 10) : null,
          awayScore: awayScoreRaw != null ? parseInt(awayScoreRaw, 10) : null,
          venue: comp?.venue?.fullName
            ? { name: comp.venue.fullName, city: comp.venue.address?.city ?? null, ianaTz: 'UTC' }
            : null,
        };
      })
      .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
  }

  async getTeams(): Promise<AppTeamRef[]> {
    const standings = await this.getStandings();
    const map = new Map<string, AppTeamRef>();
    for (const g of standings) {
      for (const r of g.rows) {
        if (r.teamId && !map.has(r.teamId)) {
          map.set(r.teamId, { id: r.teamId, name: r.teamName, crestUrl: r.crestUrl ?? null });
        }
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
