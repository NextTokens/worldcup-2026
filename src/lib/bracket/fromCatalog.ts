import seedJson from '@/data/bracket-2026.seed.json';
import type { BracketSeed, StandingsInput, RankedTeam, TeamLite } from './types';
import type { AppGroupStanding, AppStandingRow } from '@/lib/data/provider';
import { compareStandingRows } from '@/lib/data/normalize';

export const bracketSeed = seedJson as unknown as BracketSeed;

function teamFromRow(r: AppStandingRow): TeamLite {
  return { id: r.teamId ?? r.teamName, name: r.teamName, crestUrl: r.crestUrl ?? null };
}

/**
 * Adapt catalog standings into the engine's StandingsInput. Marks groups
 * non-final by default (projection mode); the cross-group third-place order is
 * computed with the default comparator.
 */
export function toStandingsInput(
  groups: AppGroupStanding[],
  allGroupsFinal = false,
): StandingsInput {
  const groupsOut: StandingsInput['groups'] = {};
  const thirds: { group: string; team: TeamLite; clinched: boolean; row: AppStandingRow }[] = [];

  for (const g of groups) {
    const ranked: RankedTeam[] = g.rows.map((r, i) => ({
      team: teamFromRow(r),
      rank: r.rank ?? i + 1,
      clinched: false,
    }));
    groupsOut[g.group] = { final: allGroupsFinal, ranked };

    const third = g.rows[2];
    if (third) {
      thirds.push({ group: g.group, team: teamFromRow(third), clinched: false, row: third });
    }
  }

  thirds.sort((a, b) => compareStandingRows(a.row, b.row));
  return {
    groups: groupsOut,
    thirdPlaceOrder: thirds.map((t) => ({ group: t.group, team: t.team, clinched: t.clinched })),
    allGroupsFinal,
  };
}
