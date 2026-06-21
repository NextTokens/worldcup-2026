import { describe, it, expect } from 'vitest';
import { resolveBracket } from './engine';
import { bracketSeed } from './fromCatalog';
import { teamPath } from './path';
import { encodeScenario, decodeScenario } from './scenario';
import type { StandingsInput, ResolveInput } from './types';

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

function buildStandings(allGroupsFinal: boolean): StandingsInput {
  const groups: StandingsInput['groups'] = {};
  for (const g of GROUPS) {
    groups[g] = {
      final: allGroupsFinal,
      ranked: [1, 2, 3, 4].map((rank) => ({
        team: { id: `${g}${rank}`, name: `${g}${rank}` },
        rank,
        clinched: allGroupsFinal,
      })),
    };
  }
  // Thirds ranked best->worst by group order A..L (so top 8 = A..H).
  const thirdPlaceOrder = GROUPS.map((g) => ({
    group: g,
    team: { id: `${g}3`, name: `${g}3` },
    clinched: allGroupsFinal,
  }));
  return { groups, thirdPlaceOrder, allGroupsFinal };
}

// Annex C row for the qualifying combo A..H, respecting each slot's candidate set.
const THIRD_MAP = {
  ABCDEFGH: { M74: 'A', M77: 'G', M79: 'C', M80: 'H', M81: 'B', M82: 'E', M85: 'F', M87: 'D' },
};

describe('resolveBracket — R32 source resolution', () => {
  const input: ResolveInput = {
    seed: bracketSeed,
    standings: buildStandings(true),
    thirdPlaceMap: THIRD_MAP,
  };
  const b = resolveBracket(input);

  it('resolves group winner/runner-up sides', () => {
    // M73 = RU-A vs RU-B
    expect(b.slots.M73.home.team?.id).toBe('A2');
    expect(b.slots.M73.away.team?.id).toBe('B2');
    // M79 = W-A vs 3rd
    expect(b.slots.M79.home.team?.id).toBe('A1');
  });

  it('assigns third-place slots exactly from Annex C when groups are final', () => {
    // M74 away = 3rd of group A => A3
    expect(b.slots.M74.away.team?.id).toBe('A3');
    expect(b.slots.M74.away.source.kind).toBe('third_place');
    // M87 away = 3rd of group D => D3
    expect(b.slots.M87.away.team?.id).toBe('D3');
    // decided when groups final + exact
    expect(b.slots.M74.away.state).toBe('decided');
  });

  it('builds a 16-leaf R32 display order', () => {
    expect(b.order).toHaveLength(16);
    expect(new Set(b.order).size).toBe(16);
    expect(b.order).toContain('M74');
  });
});

describe('resolveBracket — propagation & outcomes', () => {
  const standings = buildStandings(true);

  it('propagates winners to a champion when results say home wins everywhere', () => {
    const results: Record<string, 'home' | 'away'> = {};
    for (const s of bracketSeed.slots) results[s.slotId] = 'home';
    const b = resolveBracket({ seed: bracketSeed, standings, results, thirdPlaceMap: THIRD_MAP });
    // home chain: M104<-M101<-M97<-M89<-M74(home=E1)
    expect(b.champion?.id).toBe('E1');
    expect(b.slots.M73.state).toBe('decided');
  });

  it('does NOT forecast knockout winners (champion null until results/picks)', () => {
    const b = resolveBracket({ seed: bracketSeed, standings, thirdPlaceMap: THIRD_MAP });
    expect(b.champion).toBeNull();
    // R32 matchup is known from standings, but no winner is invented.
    expect(b.slots.M73.home.team?.id).toBe('A2');
    expect(b.slots.M73.winner).toBeNull();
    // R16 slot shows the REAL teams that could reach it (from the R32 below).
    const m89 = b.slots.M89;
    expect(m89.home.team).toBeNull();
    expect(m89.home.possible.map((t) => t.id)).toEqual(expect.arrayContaining(['E1', 'A3']));
  });

  it('applies what-if overrides and recomputes downstream', () => {
    const results: Record<string, 'home' | 'away'> = {};
    for (const s of bracketSeed.slots) results[s.slotId] = 'home';
    const b = resolveBracket({
      seed: bracketSeed,
      standings,
      results,
      overrides: { M104: 'away' },
      thirdPlaceMap: THIRD_MAP,
    });
    // away of final = winner M102 -> home chain -> M76 home = C1
    expect(b.champion?.id).toBe('C1');
    expect(b.slots.M104.overridden).toBe(true);
    expect(b.slots.M104.state).toBe('projected');
  });
});

describe('resolveBracket — projected third place (groups not final)', () => {
  it('greedily assigns a candidate third and marks it projected', () => {
    const b = resolveBracket({ seed: bracketSeed, standings: buildStandings(false) });
    // M74 candidates A/B/C/D/F -> highest-ranked qualifying third = A3
    expect(b.slots.M74.away.team?.id).toBe('A3');
    expect(b.slots.M74.away.state).toBe('projected');
  });
});

describe('teamPath', () => {
  it('returns a team road from entry to the final', () => {
    const standings = buildStandings(true);
    const results: Record<string, 'home' | 'away'> = {};
    for (const s of bracketSeed.slots) results[s.slotId] = 'home';
    const b = resolveBracket({ seed: bracketSeed, standings, results, thirdPlaceMap: THIRD_MAP });
    const path = teamPath(bracketSeed, b, 'E1'); // E1 wins everything as home
    // R32 -> R16 -> QF -> SF -> F = 5 steps
    expect(path).toHaveLength(5);
    expect(path[0].slot.round).toBe('R32');
    expect(path[path.length - 1].slot.round).toBe('F');
  });
});

describe('scenario codec', () => {
  it('round-trips overrides', () => {
    const ov = { M79: 'home', M92: 'away' } as const;
    expect(decodeScenario(encodeScenario(ov))).toEqual(ov);
  });
  it('ignores malformed input', () => {
    expect(decodeScenario('garbage::x,M1')).toEqual({});
    expect(decodeScenario(null)).toEqual({});
  });
});
