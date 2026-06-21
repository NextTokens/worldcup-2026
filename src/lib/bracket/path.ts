import type { BracketSeed, ResolvedBracket, ResolvedSide, ResolvedSlot } from './types';

/** child slotId -> the parent match its winner advances to, and on which side. */
export function buildParentMap(
  seed: BracketSeed,
): Record<string, { parent: string; side: 'home' | 'away' }> {
  const map: Record<string, { parent: string; side: 'home' | 'away' }> = {};
  for (const slot of seed.slots) {
    if (slot.home.kind === 'match_winner') {
      map[slot.home.slotId] = { parent: slot.slotId, side: 'home' };
    }
    if (slot.away.kind === 'match_winner') {
      map[slot.away.slotId] = { parent: slot.slotId, side: 'away' };
    }
  }
  return map;
}

export interface PathStep {
  slot: ResolvedSlot;
  teamSide: 'home' | 'away';
  opponent: ResolvedSide;
}

/** The R32 slot + side where a team enters the bracket (if currently placed). */
export function findTeamEntry(
  bracket: ResolvedBracket,
  teamId: string,
): { slotId: string; side: 'home' | 'away' } | null {
  for (const slotId of bracket.order) {
    const s = bracket.slots[slotId];
    if (s.home.team?.id === teamId) return { slotId, side: 'home' };
    if (s.away.team?.id === teamId) return { slotId, side: 'away' };
  }
  return null;
}

/**
 * The team's projected road to the final: the chain of matches it would play
 * assuming it keeps advancing, with the (projected/decided) opponent each round.
 */
export function teamPath(
  seed: BracketSeed,
  bracket: ResolvedBracket,
  teamId: string,
): PathStep[] {
  const entry = findTeamEntry(bracket, teamId);
  if (!entry) return [];
  const parents = buildParentMap(seed);
  const steps: PathStep[] = [];

  // Entry round.
  const entrySlot = bracket.slots[entry.slotId];
  steps.push({
    slot: entrySlot,
    teamSide: entry.side,
    opponent: entry.side === 'home' ? entrySlot.away : entrySlot.home,
  });

  // Advance toward the final.
  let child = entry.slotId;
  while (parents[child]) {
    const { parent, side } = parents[child];
    const prs = bracket.slots[parent];
    if (!prs) break;
    steps.push({
      slot: prs,
      teamSide: side,
      opponent: side === 'home' ? prs.away : prs.home,
    });
    child = parent;
  }

  return steps;
}
