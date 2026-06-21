import type { AppMatch, AppGroupStanding, AppStandingRow } from './provider';

/**
 * Default standings comparator — simplified (points → GD → GF → name).
 * The FULL 2026 tie-break chain (head-to-head first; see ARCHITECTURE.md §3)
 * is applied when ranks come from football-data.org. This comparator powers the
 * no-key fallback table and the bracket projection heuristic.
 */
export function compareStandingRows(a: AppStandingRow, b: AppStandingRow): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return a.teamName.localeCompare(b.teamName);
}

/** Compute group tables from finished group-stage matches. */
export function computeStandings(matches: AppMatch[]): AppGroupStanding[] {
  const byGroup = new Map<string, Map<string, AppStandingRow>>();

  const ensure = (group: string, team: NonNullable<AppMatch['home']>): AppStandingRow => {
    if (!byGroup.has(group)) byGroup.set(group, new Map());
    const g = byGroup.get(group)!;
    const key = team.id ?? team.name;
    if (!g.has(key)) {
      g.set(key, {
        teamId: team.id,
        teamName: team.name,
        crestUrl: team.crestUrl ?? null,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      });
    }
    return g.get(key)!;
  };

  for (const m of matches) {
    if (m.round !== 'group' || !m.group || !m.home || !m.away) continue;
    const hr = ensure(m.group, m.home);
    const ar = ensure(m.group, m.away);
    if (m.status === 'finished' && m.homeScore != null && m.awayScore != null) {
      hr.played++;
      ar.played++;
      hr.goalsFor += m.homeScore;
      hr.goalsAgainst += m.awayScore;
      ar.goalsFor += m.awayScore;
      ar.goalsAgainst += m.homeScore;
      if (m.homeScore > m.awayScore) {
        hr.won++;
        hr.points += 3;
        ar.lost++;
      } else if (m.homeScore < m.awayScore) {
        ar.won++;
        ar.points += 3;
        hr.lost++;
      } else {
        hr.drawn++;
        ar.drawn++;
        hr.points++;
        ar.points++;
      }
    }
  }

  const out: AppGroupStanding[] = [];
  for (const [group, rows] of byGroup) {
    const arr = [...rows.values()];
    arr.forEach((r) => (r.goalDifference = r.goalsFor - r.goalsAgainst));
    arr.sort(compareStandingRows);
    arr.forEach((r, i) => (r.rank = i + 1));
    out.push({ group, rows: arr });
  }
  out.sort((a, b) => a.group.localeCompare(b.group));
  return out;
}
