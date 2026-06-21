import type {
  MatchDataProvider,
  AppMatch,
  AppGroupStanding,
  AppTeamRef,
  Round,
} from '../provider';

/**
 * OpenFootball provider — CC0 static schedule (groups, dates, venues) served via
 * jsDelivr. Used as a no-API-key fallback so the app shows the real fixture
 * structure offline/in dev. Schedule + metadata only — NO live scores/events.
 * Source: https://github.com/openfootball/worldcup.json (2026/worldcup.json)
 */

const URL_2026 =
  'https://cdn.jsdelivr.net/gh/openfootball/worldcup.json@master/2026/worldcup.json';

type RawTeam = string | { name?: string; key?: string; code?: string };
interface RawMatch {
  num?: number;
  round?: string;
  date?: string;
  time?: string;
  team1?: RawTeam;
  team2?: RawTeam;
  group?: string;
  stadium?: RawTeam;
  ground?: RawTeam; // OpenFootball uses `ground` for the venue
  city?: string;
  score?: { ft?: [number, number] };
}
interface RawDoc {
  name?: string;
  rounds?: { name?: string; matches?: RawMatch[] }[];
  matches?: RawMatch[];
}

function teamName(t: RawTeam | undefined): string | null {
  if (!t) return null;
  if (typeof t === 'string') return t || null;
  return t.name ?? t.key ?? t.code ?? null;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function groupLetter(group: string | undefined): string | null {
  if (!group) return null;
  const m = /([A-L])\s*$/.exec(group.toUpperCase());
  return m ? m[1] : null;
}

function mapRound(round: string | undefined, hasGroup: boolean): Round {
  const r = (round ?? '').toLowerCase();
  if (r.includes('32')) return 'R32';
  if (r.includes('16')) return 'R16';
  if (r.includes('quarter')) return 'QF';
  if (r.includes('semi')) return 'SF';
  if (r.includes('third') || r.includes('3rd')) return '3P';
  if (r.includes('final')) return 'F';
  return hasGroup ? 'group' : 'group';
}

function kickoffUtc(date: string | undefined, time: string | undefined): string {
  if (!date) return new Date(0).toISOString();
  // OpenFootball times look like "13:00" or "13:00 UTC-6" — parse the offset it provides.
  const m = /^(\d{1,2}):(\d{2})(?:\s*UTC\s*([+-])(\d{1,2}))?$/.exec((time ?? '').trim());
  const hh = (m ? m[1] : '0').padStart(2, '0');
  const mm = m ? m[2] : '00';
  let offset = 'Z';
  if (m && m[3] && m[4]) offset = `${m[3]}${m[4].padStart(2, '0')}:00`;
  const d = new Date(`${date}T${hh}:${mm}:00${offset}`);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

function flatten(doc: RawDoc): RawMatch[] {
  if (Array.isArray(doc.matches)) return doc.matches;
  if (Array.isArray(doc.rounds)) return doc.rounds.flatMap((r) => r.matches ?? []);
  return [];
}

async function load(): Promise<RawMatch[]> {
  try {
    const res = await fetch(URL_2026, { next: { revalidate: 86400, tags: ['openfootball'] } });
    if (!res.ok) return [];
    return flatten((await res.json()) as RawDoc);
  } catch {
    return [];
  }
}

export class OpenFootballProvider implements MatchDataProvider {
  readonly name = 'openfootball';
  readonly capabilities = {
    fixtures: true,
    standings: false,
    squads: false,
    live: false,
    events: false,
    lineups: false,
  };

  async getMatches(): Promise<AppMatch[]> {
    const raw = await load();
    const out: AppMatch[] = [];
    raw.forEach((m, i) => {
      const h = teamName(m.team1);
      const a = teamName(m.team2);
      const group = groupLetter(m.group);
      const venueName = teamName(m.stadium) ?? teamName(m.ground);
      const ft = m.score?.ft;
      out.push({
        id: m.num != null ? `of-${m.num}` : `of-i-${i}`,
        matchNumber: m.num ?? null,
        round: mapRound(m.round, !!group),
        group,
        kickoffUtc: kickoffUtc(m.date, m.time),
        status: ft ? 'finished' : 'scheduled',
        home: h ? { id: slug(h), name: h } : null,
        away: a ? { id: slug(a), name: a } : null,
        homeScore: ft ? ft[0] : null,
        awayScore: ft ? ft[1] : null,
        venue: venueName ? { name: venueName, city: m.city ?? null, ianaTz: 'UTC' } : null,
      });
    });
    return out;
  }

  async getStandings(): Promise<AppGroupStanding[]> {
    // No standings source; the registry computes tables from finished matches.
    return [];
  }

  async getTeams(): Promise<AppTeamRef[]> {
    const matches = await this.getMatches();
    const seen = new Map<string, AppTeamRef>();
    for (const m of matches) {
      for (const t of [m.home, m.away]) {
        if (t?.id && !seen.has(t.id)) seen.set(t.id, t);
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
