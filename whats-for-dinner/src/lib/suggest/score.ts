import { nameSimilarity, normalizeName } from '@/lib/normalize';
import { coversAmount } from '@/lib/units';
import type { Dish, Household, Member, MissingIngredient, PantryItem } from '@/lib/types';

/**
 * The local ranker.
 *
 * This is what decides "what could we actually cook tonight". It runs before
 * (and instead of) the model: the assistant's job is to choose between a few
 * good candidates and explain the pick, not to invent a meal from nothing.
 */

export type ScoredDish = {
  dish: Dish;
  score: number;
  /** Required ingredients already on hand, as a fraction 0..1. */
  coverage: number;
  missing: MissingIngredient[];
  /** Pantry items nearing their use-by date that this dish would use up. */
  usesSoon: string[];
  /** Human-readable scoring notes, surfaced when there is no API key. */
  because: string[];
  blocked: string | null;
};

export type ScoreContext = {
  household: Household;
  members: Member[];
  pantry: PantryItem[];
  /** Date the dinner is for, YYYY-MM-DD. */
  date: string;
  /** Dish ids already planned in the window we are filling, to avoid repeats. */
  alreadyPlannedDishIds?: number[];
  /** Average rating per dish id, from family feedback. */
  ratings?: Record<number, number>;
};

const DAY_MS = 86_400_000;

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY;
  return Math.round((b - a) / DAY_MS);
}

function isWeekend(dateIso: string): boolean {
  const d = new Date(`${dateIso}T00:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
}

/** Best pantry match for an ingredient, or null when nothing on the shelf fits. */
export function findInPantry(pantry: PantryItem[], ingredientName: string): PantryItem | null {
  let best: PantryItem | null = null;
  let bestScore = 0;
  for (const item of pantry) {
    if (item.quantity <= 0) continue;
    const s = nameSimilarity(item.name, ingredientName);
    if (s > bestScore) {
      bestScore = s;
      best = item;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

/** What the pantry does and does not cover for one dish. */
export function pantryCoverage(dish: Dish, pantry: PantryItem[], today: string) {
  const required = dish.ingredients.filter((i) => !i.optional);
  const missing: MissingIngredient[] = [];
  const usesSoon: string[] = [];
  let have = 0;

  for (const ing of dish.ingredients) {
    const match = findInPantry(pantry, ing.name);
    if (!match) {
      if (!ing.optional) missing.push({ name: ing.name, quantity: ing.quantity, unit: ing.unit });
      continue;
    }

    const enough = coversAmount(
      { quantity: match.quantity, unit: match.unit },
      { quantity: ing.quantity, unit: ing.unit },
    );
    // `null` = units are not comparable; having the item at all is good enough.
    if (enough === false) {
      if (!ing.optional) missing.push({ name: ing.name, quantity: ing.quantity, unit: ing.unit });
      continue;
    }

    if (!ing.optional) have += 1;
    if (match.useBy && daysBetween(today, match.useBy) <= 3) usesSoon.push(match.name);
  }

  const coverage = required.length === 0 ? 1 : have / required.length;
  return { coverage, missing, usesSoon };
}

/** Allergy / hard-avoid check. Returns the offending term, or null when safe. */
export function hardBlock(dish: Dish, ctx: ScoreContext): string | null {
  const terms: { term: string; who: string }[] = [];
  for (const m of ctx.members) {
    for (const a of m.allergies) terms.push({ term: a, who: `${m.name}'s allergy` });
  }
  for (const a of ctx.household.avoid) terms.push({ term: a, who: 'household avoid list' });

  const haystack = [dish.name, dish.cuisine, ...dish.tags, ...dish.ingredients.map((i) => i.name)]
    .map((t) => normalizeName(t))
    .filter(Boolean);

  for (const { term, who } of terms) {
    const needle = normalizeName(term);
    if (!needle) continue;
    if (haystack.some((h) => h === needle || h.includes(needle) || needle.includes(h))) {
      return `${term} (${who})`;
    }
  }
  return null;
}

/** Score a single dish for a given night. Higher is better; blocked dishes score 0. */
export function scoreDish(dish: Dish, ctx: ScoreContext): ScoredDish {
  const { coverage, missing, usesSoon } = pantryCoverage(dish, ctx.pantry, ctx.date);
  const because: string[] = [];

  const blocked = hardBlock(dish, ctx);
  if (blocked) {
    return { dish, score: 0, coverage, missing, usesSoon, because: [`Skipped: contains ${blocked}`], blocked };
  }

  // Cook-from-what-we-have is the whole point, so coverage dominates.
  let score = coverage * 100;
  if (coverage === 1) because.push('You have everything for this');
  else if (missing.length <= 2) because.push(`Only ${missing.length} item${missing.length === 1 ? '' : 's'} short`);

  // Use up what is about to go off.
  if (usesSoon.length) {
    score += 12 * Math.min(usesSoon.length, 2);
    because.push(`Uses up ${usesSoon.slice(0, 2).join(' and ')}`);
  }

  // Don't serve the same thing twice in a fortnight.
  const repeatWindow = ctx.household.noRepeatDays;
  if (dish.lastCookedAt) {
    const since = daysBetween(dish.lastCookedAt, ctx.date);
    if (since < repeatWindow) {
      score -= 45 * (1 - since / Math.max(repeatWindow, 1));
      because.push(`Cooked ${since === 0 ? 'today' : `${since} day${since === 1 ? '' : 's'} ago`}`);
    } else if (since > repeatWindow * 4) {
      score += 6;
      because.push('Not had in a while');
    }
  } else {
    score += 4;
  }

  if (ctx.alreadyPlannedDishIds?.includes(dish.id)) score -= 60;

  // Time budget for the night in question.
  const budget = isWeekend(ctx.date) ? ctx.household.weekendMinutes : ctx.household.weeknightMinutes;
  if (dish.effortMinutes <= budget) {
    score += 8;
    if (dish.effortMinutes <= budget * 0.6) because.push(`Quick — about ${dish.effortMinutes} min`);
  } else {
    score -= Math.min(30, (dish.effortMinutes - budget) * 0.8);
    because.push(`Takes ${dish.effortMinutes} min, longer than tonight's ${budget}`);
  }

  // Family taste.
  const text = [dish.name, dish.cuisine, ...dish.tags].map((t) => normalizeName(t)).join(' ');
  let likeHits = 0;
  let dislikeHits = 0;
  for (const m of ctx.members) {
    for (const like of m.likes) {
      const n = normalizeName(like);
      if (n && text.includes(n)) likeHits += 1;
    }
    for (const d of m.dislikes) {
      const n = normalizeName(d);
      if (!n) continue;
      if (text.includes(n) || dish.ingredients.some((i) => normalizeName(i.name).includes(n))) dislikeHits += 1;
    }
  }
  score += likeHits * 7 - dislikeHits * 18;
  if (likeHits && !dislikeHits) because.push('Matches what the family likes');
  if (dislikeHits) because.push('Someone in the family is not keen on this');

  if (ctx.household.cuisines.length && dish.cuisine) {
    const wanted = ctx.household.cuisines.map((c) => normalizeName(c));
    if (wanted.includes(normalizeName(dish.cuisine))) score += 5;
  }

  if (dish.favorite) {
    score += 10;
    because.push('A family favourite');
  }

  const rating = ctx.ratings?.[dish.id];
  if (typeof rating === 'number') {
    score += (rating - 3) * 8;
    if (rating >= 4.5) because.push('Rated highly last time');
    if (rating <= 2) because.push('Did not go down well last time');
  }

  return { dish, score: Math.max(score, 0), coverage, missing, usesSoon, because, blocked: null };
}

/**
 * Rank the family's repertoire for one night.
 * Blocked dishes are dropped entirely — never suggest around an allergy.
 */
export function rankDishes(dishes: Dish[], ctx: ScoreContext): ScoredDish[] {
  return dishes
    .filter((d) => d.active)
    .map((d) => scoreDish(d, ctx))
    .filter((s) => !s.blocked)
    .sort((a, b) => b.score - a.score || a.missing.length - b.missing.length);
}
