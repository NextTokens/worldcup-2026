import { describe, expect, it } from 'vitest';
import { hardBlock, pantryCoverage, rankDishes, scoreDish, type ScoreContext } from './score';
import { normalizeName } from '@/lib/normalize';
import type { Dish, DishIngredient, Household, Member, PantryItem } from '@/lib/types';

const household: Household = {
  id: 1,
  name: 'Test family',
  servings: 4,
  weeknightMinutes: 40,
  weekendMinutes: 90,
  cuisines: ['italian'],
  avoid: [],
  noRepeatDays: 10,
  budget: 'medium',
  shoppingDay: null,
  notes: '',
  onboarded: true,
};

function member(overrides: Partial<Member> = {}): Member {
  return {
    id: 1,
    householdId: 1,
    name: 'Sam',
    isCook: false,
    likes: [],
    dislikes: [],
    allergies: [],
    diet: '',
    notes: '',
    sortOrder: 0,
    ...overrides,
  };
}

function pantry(rows: [string, number, string, (string | null)?][]): PantryItem[] {
  return rows.map(([name, quantity, unit, useBy], i) => ({
    id: i + 1,
    householdId: 1,
    name,
    normName: normalizeName(name),
    category: 'other',
    quantity,
    unit,
    parLevel: 0,
    staple: false,
    useBy: useBy ?? null,
    note: '',
    updatedAt: '2026-01-01T00:00:00Z',
  }));
}

function dish(name: string, ingredients: DishIngredient[], overrides: Partial<Dish> = {}): Dish {
  return {
    id: 1,
    householdId: 1,
    name,
    normName: normalizeName(name),
    cuisine: 'italian',
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
    ...overrides,
  };
}

const ing = (name: string, quantity = 0, unit = 'unit', optional = false): DishIngredient => ({
  name,
  quantity,
  unit,
  optional,
});

// A Wednesday.
const DATE = '2026-09-16';

function ctx(overrides: Partial<ScoreContext> = {}): ScoreContext {
  return { household, members: [member()], pantry: [], date: DATE, ...overrides };
}

describe('pantryCoverage', () => {
  it('counts only required ingredients', () => {
    const d = dish('Pasta', [ing('pasta', 500, 'g'), ing('parmesan', 50, 'g', true)]);
    const result = pantryCoverage(d, pantry([['pasta', 1, 'kg']]), DATE);
    expect(result.coverage).toBe(1);
    expect(result.missing).toEqual([]);
  });

  it('reports what is short', () => {
    const d = dish('Pasta', [ing('pasta', 500, 'g'), ing('tomatoes', 400, 'g')]);
    const result = pantryCoverage(d, pantry([['pasta', 1, 'kg']]), DATE);
    expect(result.coverage).toBe(0.5);
    expect(result.missing.map((m) => m.name)).toEqual(['tomatoes']);
  });

  it('treats too small an amount as missing', () => {
    const d = dish('Pasta', [ing('pasta', 500, 'g')]);
    const result = pantryCoverage(d, pantry([['pasta', 100, 'g']]), DATE);
    expect(result.missing).toHaveLength(1);
  });

  it('flags items close to their use-by', () => {
    const d = dish('Omelette', [ing('eggs', 4, 'unit')]);
    const result = pantryCoverage(d, pantry([['eggs', 6, 'unit', '2026-09-17']]), DATE);
    expect(result.usesSoon).toEqual(['eggs']);
  });
});

describe('hardBlock', () => {
  it('blocks an allergen anywhere in the dish', () => {
    const d = dish('Satay', [ing('peanut butter', 3, 'tbsp')]);
    const blocked = hardBlock(d, ctx({ members: [member({ allergies: ['peanuts'] })] }));
    expect(blocked).toContain('peanuts');
  });

  it('blocks the household avoid list', () => {
    const d = dish('Bacon pasta', [ing('bacon', 200, 'g')]);
    const blocked = hardBlock(d, ctx({ household: { ...household, avoid: ['pork', 'bacon'] } }));
    expect(blocked).toContain('bacon');
  });

  it('lets safe dishes through', () => {
    const d = dish('Tomato pasta', [ing('pasta', 500, 'g'), ing('tomatoes', 400, 'g')]);
    expect(hardBlock(d, ctx({ members: [member({ allergies: ['peanuts'] })] }))).toBeNull();
  });
});

describe('scoreDish', () => {
  const shelf = pantry([
    ['pasta', 1, 'kg'],
    ['tinned tomatoes', 4, 'can'],
  ]);
  const simple = dish('Tomato pasta', [ing('pasta', 500, 'g'), ing('tinned tomatoes', 1, 'can')]);

  it('rewards a dish the pantry fully covers', () => {
    const full = scoreDish(simple, ctx({ pantry: shelf }));
    const short = scoreDish(simple, ctx({ pantry: pantry([['pasta', 1, 'kg']]) }));
    expect(full.score).toBeGreaterThan(short.score);
  });

  it('penalises something cooked two days ago', () => {
    const fresh = scoreDish(simple, ctx({ pantry: shelf }));
    const repeat = scoreDish(dish('Tomato pasta', simple.ingredients, { lastCookedAt: '2026-09-14' }), ctx({ pantry: shelf }));
    expect(repeat.score).toBeLessThan(fresh.score);
  });

  it('penalises a dish that overruns a weeknight', () => {
    const quick = scoreDish(simple, ctx({ pantry: shelf }));
    const slow = scoreDish(dish('Slow ragu', simple.ingredients, { effortMinutes: 180 }), ctx({ pantry: shelf }));
    expect(slow.score).toBeLessThan(quick.score);
  });

  it('weighs a dislike more heavily than a like', () => {
    const liked = scoreDish(simple, ctx({ pantry: shelf, members: [member({ likes: ['pasta'] })] }));
    const disliked = scoreDish(simple, ctx({ pantry: shelf, members: [member({ dislikes: ['tomatoes'] })] }));
    expect(disliked.score).toBeLessThan(liked.score);
  });

  it('takes past ratings into account', () => {
    const loved = scoreDish(simple, ctx({ pantry: shelf, ratings: { 1: 5 } }));
    const hated = scoreDish(simple, ctx({ pantry: shelf, ratings: { 1: 1 } }));
    expect(loved.score).toBeGreaterThan(hated.score);
  });

  it('explains itself', () => {
    const scored = scoreDish(simple, ctx({ pantry: shelf }));
    expect(scored.because.join(' ')).toContain('everything');
  });
});

describe('rankDishes', () => {
  const shelf = pantry([['pasta', 1, 'kg'], ['tinned tomatoes', 2, 'can'], ['peanut butter', 1, 'jar']]);

  const dishes = [
    dish('Tomato pasta', [ing('pasta', 500, 'g'), ing('tinned tomatoes', 1, 'can')], { id: 1 }),
    dish('Satay noodles', [ing('peanut butter', 3, 'tbsp'), ing('noodles', 300, 'g')], { id: 2 }),
    dish('Steak', [ing('steak', 600, 'g')], { id: 3 }),
    dish('Retired dish', [ing('pasta', 200, 'g')], { id: 4, active: false }),
  ];

  it('puts the best-covered dish first', () => {
    const ranked = rankDishes(dishes, ctx({ pantry: shelf }));
    expect(ranked[0].dish.name).toBe('Tomato pasta');
  });

  it('drops allergen dishes entirely rather than ranking them low', () => {
    const ranked = rankDishes(dishes, ctx({ pantry: shelf, members: [member({ allergies: ['peanut'] })] }));
    expect(ranked.map((r) => r.dish.name)).not.toContain('Satay noodles');
  });

  it('ignores dishes that are resting', () => {
    const ranked = rankDishes(dishes, ctx({ pantry: shelf }));
    expect(ranked.map((r) => r.dish.name)).not.toContain('Retired dish');
  });

  it('avoids repeating what is already planned this week', () => {
    const ranked = rankDishes(dishes, ctx({ pantry: shelf, alreadyPlannedDishIds: [1] }));
    expect(ranked[0].dish.name).not.toBe('Tomato pasta');
  });
});
