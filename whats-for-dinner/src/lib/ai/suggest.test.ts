import { beforeEach, describe, expect, it } from 'vitest';
import { suggestDinner, suggestWeek, type SuggestInput } from './suggest';
import { normalizeName } from '@/lib/normalize';
import type { Dish, DishIngredient, Household, PantryItem } from '@/lib/types';

/**
 * These cover the no-API-key path: the app has to stay useful on the local
 * ranker alone, and it is also what every failed OpenAI call falls back to.
 */

const household: Household = {
  id: 1,
  name: 'Test',
  servings: 4,
  weeknightMinutes: 40,
  weekendMinutes: 120,
  cuisines: [],
  avoid: [],
  noRepeatDays: 10,
  budget: 'medium',
  shoppingDay: null,
  notes: '',
  onboarded: true,
};

const ing = (name: string, quantity = 0, unit = 'unit'): DishIngredient => ({
  name,
  quantity,
  unit,
  optional: false,
});

function dish(id: number, name: string, ingredients: DishIngredient[]): Dish {
  return {
    id,
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

function pantryItem(name: string, quantity: number, unit: string): PantryItem {
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
  };
}

const dishes = [
  dish(1, 'Chicken and rice', [ing('chicken thighs', 800, 'g'), ing('rice', 500, 'g')]),
  dish(2, 'Tomato pasta', [ing('pasta', 500, 'g'), ing('tomatoes', 4)]),
  dish(3, 'Lentil soup', [ing('lentils', 300, 'g'), ing('onions', 2)]),
];

const pantry = [
  pantryItem('Chicken thighs', 2, 'kg'),
  pantryItem('Rice', 3, 'kg'),
  pantryItem('Pasta', 1, 'kg'),
  pantryItem('Tomatoes', 8, 'unit'),
  pantryItem('Lentils', 1, 'kg'),
  pantryItem('Onions', 5, 'unit'),
];

function input(overrides: Partial<SuggestInput> = {}): SuggestInput {
  return { household, members: [], pantry, dishes, history: [], ratings: {}, date: '2026-09-16', ...overrides };
}

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
});

describe('suggestDinner without an API key', () => {
  it('still returns options, marked as locally generated', async () => {
    const set = await suggestDinner(input());
    expect(set.generatedBy).toBe('local');
    expect(set.options.length).toBe(3);
    expect(set.options[0].reason).not.toBe('');
  });

  it('explains itself when there is nothing to suggest', async () => {
    const set = await suggestDinner(input({ dishes: [] }));
    expect(set.options).toEqual([]);
    expect(set.note).toContain('Add a few dishes');
  });
});

describe('suggestWeek without an API key', () => {
  const dates = ['2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19'];

  it('never serves the same dish twice in one planned week', async () => {
    const week = await suggestWeek(input(), dates);
    const names = week.flatMap((d) => d.options.map((o) => o.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it('leaves nights open once the repertoire runs out rather than repeating', async () => {
    const week = await suggestWeek(input({ dishes: [dishes[0]] }), dates);
    expect(week[0].options).toHaveLength(1);
    expect(week.slice(1).every((d) => d.options.length === 0)).toBe(true);
  });

  it('returns one entry per requested date, in order', async () => {
    const week = await suggestWeek(input(), dates);
    expect(week.map((d) => d.date)).toEqual(dates);
  });
});

describe('suggestWeek around already-decided nights', () => {
  it('does not re-serve a dish that is fixed elsewhere in the same week', async () => {
    const week = await suggestWeek(input(), ['2026-09-17', '2026-09-18'], [1]);
    const names = week.flatMap((d) => d.options.map((o) => o.name));
    expect(names).not.toContain('Chicken and rice');
    expect(names).toHaveLength(2);
  });
});
