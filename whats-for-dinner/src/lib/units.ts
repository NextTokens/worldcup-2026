/**
 * Minimal kitchen unit handling.
 *
 * We deliberately do not try to be a full unit-conversion library: the goal is
 * only to answer "does the pantry plausibly hold enough for this dish?" and
 * "how much should we buy back?". Anything we cannot convert falls back to a
 * presence check, which is what a cook does anyway.
 */

export type UnitFamily = 'count' | 'mass' | 'volume' | 'spoon' | 'unknown';

const ALIASES: Record<string, string> = {
  '': 'unit', unit: 'unit', units: 'unit', pc: 'unit', pcs: 'unit', piece: 'unit', pieces: 'unit',
  x: 'unit', ea: 'unit', each: 'unit', clove: 'unit', cloves: 'unit', bunch: 'unit', bunches: 'unit',
  pack: 'pack', packs: 'pack', packet: 'pack', tin: 'can', tins: 'can', can: 'can', cans: 'can',
  bottle: 'bottle', bottles: 'bottle', jar: 'jar', jars: 'jar', box: 'pack', boxes: 'pack',
  g: 'g', gr: 'g', gram: 'g', grams: 'g', gramme: 'g', grammes: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb', oz: 'oz', ounce: 'oz', ounces: 'oz',
  ml: 'ml', milliliter: 'ml', millilitre: 'ml', milliliters: 'ml', millilitres: 'ml',
  l: 'l', lt: 'l', liter: 'l', litre: 'l', liters: 'l', litres: 'l',
  cup: 'cup', cups: 'cup',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  pinch: 'pinch', pinches: 'pinch', dash: 'pinch',
};

/** grams / millilitres / spoons per canonical unit, within its family. */
const FACTORS: Record<string, { family: UnitFamily; factor: number }> = {
  unit: { family: 'count', factor: 1 },
  pack: { family: 'count', factor: 1 },
  can: { family: 'count', factor: 1 },
  bottle: { family: 'count', factor: 1 },
  jar: { family: 'count', factor: 1 },
  g: { family: 'mass', factor: 1 },
  kg: { family: 'mass', factor: 1000 },
  oz: { family: 'mass', factor: 28.35 },
  lb: { family: 'mass', factor: 453.6 },
  ml: { family: 'volume', factor: 1 },
  l: { family: 'volume', factor: 1000 },
  cup: { family: 'volume', factor: 240 },
  tbsp: { family: 'spoon', factor: 1 },
  tsp: { family: 'spoon', factor: 1 / 3 },
  pinch: { family: 'spoon', factor: 1 / 12 },
};

/** Canonical spelling of a unit as the app stores it. */
export function canonicalUnit(unit: string | null | undefined): string {
  const key = (unit ?? '').trim().toLowerCase();
  return ALIASES[key] ?? (FACTORS[key] ? key : key || 'unit');
}

export function unitFamily(unit: string | null | undefined): UnitFamily {
  const c = canonicalUnit(unit);
  return FACTORS[c]?.family ?? 'unknown';
}

/** Convert to the family's base amount, or null when the unit is unknown. */
export function toBase(quantity: number, unit: string | null | undefined): { family: UnitFamily; amount: number } | null {
  const c = canonicalUnit(unit);
  const spec = FACTORS[c];
  if (!spec) return null;
  return { family: spec.family, amount: quantity * spec.factor };
}

/**
 * Is `have` enough for `need`? `null` means "not comparable" — different or
 * unknown unit families — and callers should treat presence as good enough.
 */
export function coversAmount(
  have: { quantity: number; unit: string | null | undefined },
  need: { quantity: number; unit: string | null | undefined },
): boolean | null {
  if (!need.quantity || need.quantity <= 0) return have.quantity > 0;
  const h = toBase(have.quantity, have.unit);
  const n = toBase(need.quantity, need.unit);
  if (!h || !n || h.family !== n.family) return null;
  // A cook rounds: 90% of the called-for amount is "we have it".
  return h.amount >= n.amount * 0.9;
}

/** Format a quantity + unit the way it would be written on a shopping list. */
export function formatAmount(quantity: number | null | undefined, unit: string | null | undefined): string {
  const q = Number(quantity ?? 0);
  const u = canonicalUnit(unit);
  if (!q) return u === 'unit' ? '' : u;
  const rounded = Math.round(q * 100) / 100;
  if (u === 'unit') return `${rounded}`;
  return `${rounded} ${u}`;
}
