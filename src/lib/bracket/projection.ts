import type { BracketSeed, StandingsInput, TeamLite } from './types';

/** Normalized key for an Annex C combination: the sorted 8 group letters. */
export function comboKey(groups: string[]): string {
  return [...groups].map((g) => g.toUpperCase()).sort().join('');
}

/**
 * EXACT third-place assignment (post group stage). Given the full Annex C table
 * (combo -> { slotId: group }) and the 8 qualifying third-place groups, returns
 * { slotId: group }. Returns null if it can't be locked yet.
 */
export function assignThirdPlacesExact(
  input: StandingsInput,
  thirdPlaceMap?: Record<string, Record<string, string>>,
): Record<string, string> | null {
  if (!input.allGroupsFinal || !thirdPlaceMap) return null;
  const qualifyingGroups = input.thirdPlaceOrder.slice(0, 8).map((t) => t.group);
  if (qualifyingGroups.length < 8) return null;
  const row = thirdPlaceMap[comboKey(qualifyingGroups)];
  return row ?? null;
}

/**
 * PROJECTED third-place assignment (group stage in progress). Greedy: assign the
 * highest-ranked qualifying third to each third-place slot whose candidate set
 * allows that third's group. Approximate — clearly flagged "projected" in UI.
 */
export function projectThirdPlaces(
  input: StandingsInput,
  seed: BracketSeed,
): Record<string, string> {
  const qualifying = input.thirdPlaceOrder.slice(0, 8); // best 8 of 12
  const used = new Set<string>();
  const out: Record<string, string> = {};

  const thirdSlots = seed.slots
    .filter((s) => s.home.kind === 'third_place' || s.away.kind === 'third_place')
    .sort((a, b) => a.matchNumber - b.matchNumber);

  for (const slot of thirdSlots) {
    const side = slot.home.kind === 'third_place' ? slot.home : slot.away;
    if (side.kind !== 'third_place') continue;
    const pick = qualifying.find(
      (t) => side.candidates.includes(t.group) && !used.has(t.group),
    );
    if (pick) {
      used.add(pick.group);
      out[slot.slotId] = pick.group;
    }
  }
  return out;
}

/** The team currently 3rd in a given group, if known. */
export function thirdOfGroup(input: StandingsInput, group: string): TeamLite | null {
  return input.thirdPlaceOrder.find((t) => t.group === group)?.team ?? null;
}

/**
 * Default match-outcome projection: the stronger team (lower rank number, e.g.
 * FIFA ranking) advances; ties / unknowns favor home. Swappable later for Elo/odds.
 */
export function pickProjectedWinner(
  home: TeamLite,
  away: TeamLite,
  rankOf?: (teamId: string) => number | undefined,
): 'home' | 'away' {
  const hr = rankOf?.(home.id);
  const ar = rankOf?.(away.id);
  if (hr == null && ar == null) return 'home';
  if (hr == null) return 'away';
  if (ar == null) return 'home';
  return hr <= ar ? 'home' : 'away';
}
