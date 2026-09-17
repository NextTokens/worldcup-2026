import { displayName, nameSimilarity, normalizeName } from '@/lib/normalize';
import { canonicalUnit, coversAmount, toBase } from '@/lib/units';
import { guessCategory } from '@/lib/categories';
import type { Dish, PantryItem, ShoppingItem } from '@/lib/types';

/**
 * Replenishment.
 *
 * Two sources feed the list:
 *   1. Staples that dropped below their par level — the things the family
 *      always keeps in and would notice running out of.
 *   2. Ingredients the coming week's planned dinners need but the pantry
 *      cannot cover.
 *
 * Anything already on the open list is left alone so manual edits survive.
 */

export type ProposedItem = {
  name: string;
  normName: string;
  category: string;
  quantity: number;
  unit: string;
  reason: string;
  source: 'auto' | 'plan';
};

export type BuildListInput = {
  pantry: PantryItem[];
  /** Dishes planned for the days we are shopping for. */
  plannedDishes: { dish: Dish; date: string }[];
  /** Items already on the open list; we never duplicate these. */
  existing: Pick<ShoppingItem, 'normName'>[];
};

function pantryMatch(pantry: PantryItem[], name: string): PantryItem | null {
  let best: PantryItem | null = null;
  let bestScore = 0;
  for (const item of pantry) {
    const s = nameSimilarity(item.name, name);
    if (s > bestScore) {
      bestScore = s;
      best = item;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

/** Merge two amounts, keeping the unit when they are comparable. */
function addAmount(
  a: { quantity: number; unit: string },
  b: { quantity: number; unit: string },
): { quantity: number; unit: string } {
  const ba = toBase(a.quantity, a.unit);
  const bb = toBase(b.quantity, b.unit);
  if (ba && bb && ba.family === bb.family) {
    // Express the total back in the first unit.
    const perUnit = ba.amount / (a.quantity || 1) || 1;
    return { quantity: Math.round(((ba.amount + bb.amount) / perUnit) * 100) / 100, unit: a.unit };
  }
  return { quantity: Math.max(a.quantity, b.quantity), unit: a.unit };
}

/**
 * Work out what to buy. Pure: callers persist the result.
 */
export function buildShoppingList(input: BuildListInput): ProposedItem[] {
  const open = new Set(input.existing.map((e) => e.normName));
  const proposed = new Map<string, ProposedItem>();

  const add = (item: ProposedItem) => {
    if (open.has(item.normName)) return;
    const found = proposed.get(item.normName);
    if (!found) {
      proposed.set(item.normName, item);
      return;
    }
    const merged = addAmount(
      { quantity: found.quantity, unit: found.unit },
      { quantity: item.quantity, unit: item.unit },
    );
    found.quantity = merged.quantity;
    found.unit = merged.unit;
    // A staple reason is the more useful one to show.
    if (item.source === 'auto') found.reason = item.reason;
  };

  // 1. Staples below par.
  for (const item of input.pantry) {
    if (!item.staple || item.parLevel <= 0) continue;
    if (item.quantity >= item.parLevel) continue;
    const shortfall = Math.max(item.parLevel - item.quantity, 0);
    add({
      name: item.name,
      normName: item.normName,
      category: item.category,
      quantity: Math.round(shortfall * 100) / 100 || 1,
      unit: canonicalUnit(item.unit),
      reason: item.quantity <= 0 ? 'Staple — you are out' : 'Staple — running low',
      source: 'auto',
    });
  }

  // 2. Gaps for the planned dinners.
  for (const { dish, date } of input.plannedDishes) {
    for (const ing of dish.ingredients) {
      if (ing.optional) continue;
      const match = pantryMatch(input.pantry, ing.name);
      const enough =
        match &&
        match.quantity > 0 &&
        coversAmount({ quantity: match.quantity, unit: match.unit }, { quantity: ing.quantity, unit: ing.unit }) !== false;
      if (enough) continue;

      const shortfall = match
        ? Math.max(ing.quantity - (canonicalUnit(match.unit) === canonicalUnit(ing.unit) ? match.quantity : 0), 0)
        : ing.quantity;

      add({
        name: displayName(ing.name),
        normName: normalizeName(ing.name),
        category: match?.category && match.category !== 'other' ? match.category : guessCategory(ing.name),
        quantity: Math.round((shortfall || ing.quantity || 1) * 100) / 100,
        unit: canonicalUnit(ing.unit),
        reason: `For ${dish.name} on ${date}`,
        source: 'plan',
      });
    }
  }

  return [...proposed.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}
