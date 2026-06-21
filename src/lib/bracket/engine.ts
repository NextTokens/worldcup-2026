import type {
  ResolveInput,
  ResolvedBracket,
  ResolvedSide,
  ResolvedSlot,
  SeedSlot,
  SlotSource,
  SlotState,
  TeamLite,
} from './types';
import { assignThirdPlacesExact, projectThirdPlaces, thirdOfGroup } from './projection';

/**
 * resolveBracket — the pure, isomorphic core (ARCHITECTURE.md §12.3).
 *
 * Fills the bracket from REAL group standings, NOT from outcome forecasting:
 *  - R32 sides resolve to the actual current 1st/2nd/3rd of each group.
 *  - Knockout (R16+) sides have no team until a real result or a user what-if
 *    override decides the feeding match; meanwhile they expose `possible` — the
 *    real teams that could reach that slot — so the UI never shows a bare
 *    "Winner of match X" placeholder.
 *  - A match has a winner ONLY from `results` (real) or `overrides` (what-if).
 */
export function resolveBracket(input: ResolveInput): ResolvedBracket {
  const { seed, standings, results = {}, overrides = {} } = input;

  const seedById = new Map<string, SeedSlot>();
  for (const s of seed.slots) seedById.set(s.slotId, s);

  const exactThirds = assignThirdPlacesExact(standings, input.thirdPlaceMap);
  if (standings.allGroupsFinal && exactThirds == null) {
    console.warn(
      '[bracket] groups are final but no Annex C thirdPlaceMap was provided — using standings-based third-place placement.',
    );
  }
  const thirdAssign = exactThirds ?? projectThirdPlaces(standings, seed);
  const thirdsAreExact = exactThirds != null && standings.allGroupsFinal;

  const resolved: Record<string, ResolvedSlot> = {};

  const childSlotId = (s: SlotSource): string | null =>
    s.kind === 'match_winner' || s.kind === 'match_loser' ? s.slotId : null;

  // All real teams that could reach a slot's winner, gathered from R32 leaves.
  function reachableTeams(slotId: string): TeamLite[] {
    const s = seedById.get(slotId);
    if (!s) return [];
    const ch = childSlotId(s.home);
    const ca = childSlotId(s.away);
    if (!ch && !ca) {
      const r = resolved[slotId];
      const out: TeamLite[] = [];
      const add = (side: ResolvedSide | undefined) => {
        if (side?.team) out.push(side.team);
        else if (side?.possible) out.push(...side.possible);
      };
      add(r?.home);
      add(r?.away);
      return out;
    }
    return [...(ch ? reachableTeams(ch) : []), ...(ca ? reachableTeams(ca) : [])];
  }

  function resolveSide(source: SlotSource, slotId: string): ResolvedSide {
    switch (source.kind) {
      case 'group_winner':
      case 'group_runnerup': {
        const rank = source.kind === 'group_winner' ? 1 : 2;
        const label = `${rank}${source.group}`;
        const g = standings.groups[source.group];
        const team = g && g.ranked.length >= rank ? g.ranked[rank - 1].team : null;
        if (!team) {
          // No standings yet: surface the group's teams as possibilities.
          return {
            source,
            team: null,
            possible: g?.ranked.map((r) => r.team) ?? [],
            state: 'open',
            confidence: 'unknown',
            label,
          };
        }
        const state: SlotState = g!.final ? 'decided' : 'projected';
        return { source, team, possible: [], state, confidence: g!.final ? 'clinched' : 'likely', label };
      }
      case 'third_place': {
        const label = `3rd ${source.candidates.join('/')}`;
        const grp = thirdAssign[slotId];
        const team = grp ? thirdOfGroup(standings, grp) : null;
        if (!team) {
          const possible = source.candidates
            .map((c) => thirdOfGroup(standings, c))
            .filter((t): t is TeamLite => t !== null);
          return { source, team: null, possible, state: 'open', confidence: 'unknown', label };
        }
        const state: SlotState = thirdsAreExact ? 'decided' : 'projected';
        return { source, team, possible: [], state, confidence: thirdsAreExact ? 'clinched' : 'contested', label };
      }
      case 'match_winner':
      case 'match_loser': {
        const feedNum = seedById.get(source.slotId)?.matchNumber;
        const label = `${source.kind === 'match_winner' ? 'W' : 'L'}${feedNum ?? '?'}`;
        const feed = resolved[source.slotId];
        const team = feed ? (source.kind === 'match_winner' ? feed.winner : feed.loser) : null;
        if (!team) {
          // Outcome not decided: show who could reach here (real teams).
          const possible =
            source.kind === 'match_winner' ? reachableTeams(source.slotId) : [];
          return { source, team: null, possible, state: 'open', confidence: 'unknown', label };
        }
        return {
          source,
          team,
          possible: [],
          state: feed!.state === 'decided' ? 'decided' : 'projected',
          confidence: feed!.state === 'decided' ? 'clinched' : 'likely',
          label,
        };
      }
    }
  }

  // Resolve in match-number order so feeding matches resolve before their parents.
  const ordered = [...seed.slots].sort((a, b) => a.matchNumber - b.matchNumber);

  for (const slot of ordered) {
    const home = resolveSide(slot.home, slot.slotId);
    const away = resolveSide(slot.away, slot.slotId);

    // Winner ONLY from a what-if override or a real result — never forecast.
    let winnerSide: 'home' | 'away' | null = overrides[slot.slotId] ?? results[slot.slotId] ?? null;
    const overridden = overrides[slot.slotId] != null;

    let winner: TeamLite | null = null;
    let loser: TeamLite | null = null;
    if (winnerSide) {
      const w = winnerSide === 'home' ? home : away;
      const l = winnerSide === 'home' ? away : home;
      if (w.team) {
        winner = w.team;
        loser = l.team;
      } else {
        winnerSide = null;
      }
    }

    let state: SlotState;
    if (winner && !overridden && results[slot.slotId] && home.state === 'decided' && away.state === 'decided') {
      state = 'decided';
    } else if (winner) {
      state = 'projected';
    } else if (home.team && away.team) {
      state = 'projected'; // matchup known from standings; outcome open
    } else {
      state = 'open';
    }

    resolved[slot.slotId] = {
      slotId: slot.slotId,
      round: slot.round,
      matchNumber: slot.matchNumber,
      date: slot.date,
      venue: slot.venue,
      home,
      away,
      winner,
      loser,
      state,
      overridden,
    };
  }

  // R32 display order (top -> bottom) via tree traversal from the final.
  const leaves = (slotId: string): string[] => {
    const s = seedById.get(slotId);
    if (!s) return [];
    const ch = childSlotId(s.home);
    const ca = childSlotId(s.away);
    if (!ch && !ca) return [slotId];
    return [...(ch ? leaves(ch) : []), ...(ca ? leaves(ca) : [])];
  };

  return {
    slots: resolved,
    order: leaves('M104'),
    champion: resolved['M104']?.winner ?? null,
  };
}
