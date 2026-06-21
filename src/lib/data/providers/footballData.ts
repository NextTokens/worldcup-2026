import type {
  MatchDataProvider,
  AppMatch,
  AppGroupStanding,
  AppTeamRef,
  AppPlayer,
  Round,
  MatchStatus,
} from '../provider';

/**
 * football-data.org provider — official, sanctioned, free tier (10 req/min).
 * Authoritative for fixtures + group standings. Scores are DELAYED on free;
 * live events come from the live provider (ESPN, Path A) instead.
 * Docs: https://docs.football-data.org  ·  Attribution required.
 */

const BASE = 'https://api.football-data.org/v4';
const COMPETITION = 'WC';

function apiKey(): string | undefined {
  return process.env.FOOTBALL_DATA_API_KEY || undefined;
}

async function fd<T>(path: string, revalidate: number): Promise<T | null> {
  const key = apiKey();
  if (!key) return null;
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, {
      headers: { 'X-Auth-Token': key },
      next: { revalidate, tags: ['football-data'] },
    });
    if (!res.ok) {
      const kind =
        res.status === 401 || res.status === 403
          ? 'auth (check FOOTBALL_DATA_API_KEY)'
          : res.status === 429
            ? 'rate-limited (10 req/min on free tier)'
            : res.status >= 500
              ? 'upstream-5xx (transient)'
              : 'client-error';
      console.error(
        `[football-data] ${res.status} ${res.statusText} (${kind}) ${url} @ ${new Date().toISOString()}`,
      );
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[football-data] network/parse error ${url}: ${String(err)}`);
    return null;
  }
}

function mapStage(stage: string | undefined): Round {
  switch (stage) {
    case 'LAST_32':
      return 'R32';
    case 'LAST_16':
      return 'R16';
    case 'QUARTER_FINALS':
      return 'QF';
    case 'SEMI_FINALS':
      return 'SF';
    case 'THIRD_PLACE':
    case '3RD_PLACE_FINAL':
      return '3P';
    case 'FINAL':
      return 'F';
    case 'GROUP_STAGE':
    case 'PLAYOFFS':
    case 'QUALIFICATION':
      return 'group';
    default:
      if (stage) console.warn(`[football-data] unmapped stage "${stage}" -> group`);
      return 'group';
  }
}

function mapStatus(status: string | undefined): MatchStatus {
  switch (status) {
    case 'IN_PLAY':
      return 'live';
    case 'PAUSED':
      return 'paused';
    case 'FINISHED':
      return 'finished';
    case 'POSTPONED':
    case 'SUSPENDED':
    case 'CANCELLED':
      return 'postponed';
    default:
      return 'scheduled';
  }
}

function groupLetter(group: string | null | undefined): string | null {
  if (!group) return null;
  const m = /([A-L])$/.exec(group.toUpperCase());
  return m ? m[1] : null;
}

interface FdTeam {
  id: number | null;
  name: string;
  tla?: string;
  crest?: string;
}
interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  group: string | null;
  matchday: number | null;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  venue?: string | null; // v4 returns the stadium name only
  score?: { fullTime?: { home: number | null; away: number | null } };
}

function teamRef(t: FdTeam | undefined): AppTeamRef | null {
  if (!t || (!t.id && !t.name)) return null;
  return {
    id: t.id != null ? String(t.id) : null,
    name: t.name ?? 'TBD',
    fifaCode: t.tla ?? null,
    crestUrl: t.crest ?? null,
  };
}

export class FootballDataProvider implements MatchDataProvider {
  readonly name = 'football-data.org';
  readonly capabilities = {
    fixtures: true,
    standings: true,
    squads: true, // requires Deep Data tier; degrades to [] otherwise
    live: false,
    events: false,
    lineups: false,
  };

  async getMatches(): Promise<AppMatch[]> {
    const data = await fd<{ matches: FdMatch[] }>(`/competitions/${COMPETITION}/matches`, 300);
    if (!data?.matches) return [];
    return data.matches.map((m) => ({
      id: String(m.id),
      matchNumber: m.matchday ?? null,
      round: mapStage(m.stage),
      group: groupLetter(m.group),
      kickoffUtc: m.utcDate,
      status: mapStatus(m.status),
      home: teamRef(m.homeTeam),
      away: teamRef(m.awayTeam),
      homeScore: m.score?.fullTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? null,
      venue: m.venue ? { name: m.venue, city: null, ianaTz: 'UTC' } : null,
    }));
  }

  async getStandings(): Promise<AppGroupStanding[]> {
    const data = await fd<{
      standings: {
        type: string;
        group: string | null;
        table: {
          position: number;
          team: FdTeam;
          playedGames: number;
          won: number;
          draw: number;
          lost: number;
          points: number;
          goalsFor: number;
          goalsAgainst: number;
          goalDifference: number;
        }[];
      }[];
    }>(`/competitions/${COMPETITION}/standings`, 300);
    if (!data?.standings) return [];

    return data.standings
      .filter((s) => s.type === 'TOTAL' && s.group)
      .map((s) => ({
        group: groupLetter(s.group) ?? '?',
        rows: s.table.map((r) => ({
          teamId: r.team.id != null ? String(r.team.id) : null,
          teamName: r.team.name,
          crestUrl: r.team.crest ?? null,
          played: r.playedGames,
          won: r.won,
          drawn: r.draw,
          lost: r.lost,
          goalsFor: r.goalsFor,
          goalsAgainst: r.goalsAgainst,
          goalDifference: r.goalDifference,
          points: r.points,
          rank: r.position,
        })),
      }))
      .sort((a, b) => a.group.localeCompare(b.group));
  }

  async getTeams(): Promise<AppTeamRef[]> {
    const data = await fd<{ teams: FdTeam[] }>(`/competitions/${COMPETITION}/teams`, 3600);
    if (!data?.teams) return [];
    return data.teams
      .map((t) => teamRef(t))
      .filter((t): t is AppTeamRef => t !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getSquad(teamId: string): Promise<AppPlayer[]> {
    const data = await fd<{
      squad?: {
        id: number;
        name: string;
        position: string | null;
        dateOfBirth: string | null;
        nationality: string | null;
        shirtNumber?: number | null;
      }[];
    }>(`/teams/${teamId}`, 3600);
    if (!data?.squad) return [];
    return data.squad.map((p) => ({
      id: String(p.id),
      name: p.name,
      position: p.position,
      dob: p.dateOfBirth,
      nationality: p.nationality,
      shirtNumber: p.shirtNumber ?? null,
    }));
  }
}
