import { describe, expect, it } from 'vitest';
import { buildShoppingList } from './shopping';
import { parseIngredientLines } from './parseIngredients';
import { normalizeName } from '@/lib/normalize';
import type { Dish, PantryItem } from '@/lib/types';

function item(name: string, quantity: number, unit: string, extra: Partial<PantryItem> = {}): PantryItem {
  return {
    id: 1,
    householdId: 1,
    name,
    normName: normalizeName(name),
    category: 'other',
    quantity,
    unit,
    parLevel: 0,
    staple: false,
    useBy: null,
    note: '',
    updatedAt: '2026-01-01T00:00:00Z',
    ...extra,
  };
}

function dish(name: string, ingredients: Dish['ingredients']): Dish {
  return {
    id: 1,
    householdId: 1,
    name,
    normName: normalizeName(name),
    cuisine: '',
    tags: [],
    effortMinutes: 30,
    servings: 4,
    ingredients,
    steps: [],
    notes: '',
    source: 'manual',
    favorite: false,
    active: true,
    timesCooked: 0,
    lastCookedAt: null,
    avgRating: null,
  };
}

describe('buildShoppingList', () => {
  it('replenishes staples that fell below their par level', () => {
    const list = buildShoppingList({
      pantry: [item('Milk', 1, 'l', { staple: true, parLevel: 3 })],
      plannedDishes: [],
      existing: [],
    });
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Milk');
    expect(list[0].quantity).toBe(2);
    expect(list[0].reason).toContain('running low');
  });

  it('says so when a staple has run out entirely', () => {
    const list = buildShoppingList({
      pantry: [item('Rice', 0, 'kg', { staple: true, parLevel: 2 })],
      plannedDishes: [],
      existing: [],
    });
    expect(list[0].reason).toContain('out');
  });

  it('leaves well-stocked staples alone', () => {
    const list = buildShoppingList({
      pantry: [item('Milk', 4, 'l', { staple: true, parLevel: 3 })],
      plannedDishes: [],
      existing: [],
    });
    expect(list).toEqual([]);
  });

  it('adds what the planned dinners are short of', () => {
    const list = buildShoppingList({
      pantry: [item('Pasta', 1, 'kg')],
      plannedDishes: [
        {
          date: '2026-09-18',
          dish: dish('Tomato pasta', [
            { name: 'pasta', quantity: 500, unit: 'g', optional: false },
            { name: 'tinned tomatoes', quantity: 2, unit: 'can', optional: false },
          ]),
        },
      ],
      existing: [],
    });
    expect(list.map((l) => l.normName)).toEqual([normalizeName('tinned tomatoes')]);
    expect(list[0].reason).toContain('Tomato pasta');
  });

  it('ignores optional ingredients', () => {
    const list = buildShoppingList({
      pantry: [],
      plannedDishes: [
        { date: '2026-09-18', dish: dish('Pasta', [{ name: 'parmesan', quantity: 50, unit: 'g', optional: true }]) },
      ],
      existing: [],
    });
    expect(list).toEqual([]);
  });

  it('never duplicates a line already on the open list', () => {
    const list = buildShoppingList({
      pantry: [item('Milk', 0, 'l', { staple: true, parLevel: 2 })],
      plannedDishes: [],
      existing: [{ normName: normalizeName('Milk') }],
    });
    expect(list).toEqual([]);
  });

  it('merges the same item needed by two dishes', () => {
    const list = buildShoppingList({
      pantry: [],
      plannedDishes: [
        { date: '2026-09-18', dish: dish('A', [{ name: 'onions', quantity: 2, unit: 'unit', optional: false }]) },
        { date: '2026-09-19', dish: dish('B', [{ name: 'onion', quantity: 3, unit: 'unit', optional: false }]) },
      ],
      existing: [],
    });
    expect(list).toHaveLength(1);
    expect(list[0].quantity).toBe(5);
  });
});

describe('parseIngredientLines', () => {
  it('reads the pipe-separated form', () => {
    expect(parseIngredientLines('chicken thighs | 800 | g')).toEqual([
      { name: 'chicken thighs', quantity: 800, unit: 'g', optional: false },
    ]);
  });

  it('reads a plain "500 g rice" line', () => {
    expect(parseIngredientLines('500 g basmati rice')).toEqual([
      { name: 'basmati rice', quantity: 500, unit: 'g', optional: false },
    ]);
  });

  it('marks optional ingredients', () => {
    expect(parseIngredientLines('yogurt (optional)')[0]).toMatchObject({ name: 'yogurt', optional: true });
  });

  it('accepts a bare name', () => {
    expect(parseIngredientLines('salt')).toEqual([{ name: 'salt', quantity: 0, unit: 'unit', optional: false }]);
  });

  it('skips blank lines', () => {
    expect(parseIngredientLines('rice\n\n  \npasta')).toHaveLength(2);
  });
});
