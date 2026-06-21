/**
 * Compact, shareable encoding of what-if picks for the URL (?wi=...).
 * Format: comma-separated `slotId:side` where side is h(ome) | a(way).
 * e.g. "M79:h,M92:a". Sides are stable because resolveBracket recomputes
 * downstream teams deterministically from the picks, in order.
 */
export type Overrides = Record<string, 'home' | 'away'>;

export function encodeScenario(overrides: Overrides): string {
  return Object.entries(overrides)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slot, side]) => `${slot}:${side === 'home' ? 'h' : 'a'}`)
    .join(',');
}

export function decodeScenario(value: string | null | undefined): Overrides {
  const out: Overrides = {};
  if (!value) return out;
  for (const part of value.split(',')) {
    const [slot, side] = part.split(':');
    if (slot && (side === 'h' || side === 'a')) {
      out[slot] = side === 'h' ? 'home' : 'away';
    }
  }
  return out;
}
