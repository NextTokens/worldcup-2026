import 'server-only';
import { askJson, aiConfigured } from './client';
import { dinnerOptionsSchema, dishIdeasSchema, pantryParseSchema, weekPlanSchema } from './schemas';
import {
  DINNER_SYSTEM,
  candidateBrief,
  dishListBrief,
  historyBrief,
  pantryBrief,
  profileBrief,
  weekdayName,
} from './prompt';
import { normalizeName } from '@/lib/normalize';
import { canonicalUnit } from '@/lib/units';
import { guessCategory } from '@/lib/categories';
import { pantryCoverage, rankDishes, type ScoreContext, type ScoredDish } from '@/lib/suggest/score';
import type {
  Dish,
  DishIngredient,
  Household,
  Member,
  PantryItem,
  PlanEntry,
  Suggestion,
  SuggestionSet,
} from '@/lib/types';

const MAX_CANDIDATES = 14;

/** Join the ranker's scoring notes into something that reads like prose. */
function sentence(parts: string[]): string {
  const text = parts.filter(Boolean).join('. ').trim();
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

export type SuggestInput = {
  household: Household;
  members: Member[];
  pantry: PantryItem[];
  dishes: Dish[];
  history: PlanEntry[];
  ratings: Record<number, number>;
  date: string;
};

type RawOption = {
  candidateIndex: number | null;
  name: string;
  cuisine: string;
  effortMinutes: number;
  reason: string;
  isNew: boolean;
  ingredients: DishIngredient[];
  steps: string[];
};

function cleanIngredients(list: unknown): DishIngredient[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((raw) => {
      const i = raw as Partial<DishIngredient>;
      const name = String(i?.name ?? '').trim();
      if (!name) return null;
      return {
        name,
        quantity: Number.isFinite(Number(i?.quantity)) ? Number(i?.quantity) : 0,
        unit: canonicalUnit(String(i?.unit ?? 'unit')),
        optional: Boolean(i?.optional),
      } satisfies DishIngredient;
    })
    .filter((i): i is DishIngredient => i !== null);
}

/** Turn one model option into a Suggestion, recomputing coverage ourselves. */
function materialise(opt: RawOption, candidates: ScoredDish[], input: SuggestInput): Suggestion | null {
  const name = String(opt?.name ?? '').trim();
  if (!name) return null;

  const idx = opt.candidateIndex;
  const candidate = typeof idx === 'number' && idx >= 0 && idx < candidates.length ? candidates[idx] : null;

  if (candidate && !opt.isNew) {
    return {
      dishId: candidate.dish.id,
      name: candidate.dish.name,
      cuisine: candidate.dish.cuisine,
      effortMinutes: candidate.dish.effortMinutes,
      reason: String(opt.reason ?? '').trim() || sentence(candidate.because),
      coverage: candidate.coverage,
      missing: candidate.missing,
      usesSoon: candidate.usesSoon,
      tags: candidate.dish.tags,
      ingredients: candidate.dish.ingredients,
      steps: candidate.dish.steps,
    };
  }

  // A newly invented dish: score it against the pantry the same way.
  const ingredients = cleanIngredients(opt.ingredients);
  if (!ingredients.length) return null;

  const pseudo: Dish = {
    id: -1,
    householdId: input.household.id,
    name,
    normName: normalizeName(name),
    cuisine: String(opt.cuisine ?? ''),
    tags: [],
    effortMinutes: Number(opt.effortMinutes) || input.household.weeknightMinutes,
    servings: input.household.servings,
    ingredients,
    steps: Array.isArray(opt.steps) ? opt.steps.map(String).filter(Boolean) : [],
    notes: '',
    source: 'ai',
    favorite: false,
    active: true,
    timesCooked: 0,
    lastCookedAt: null,
    avgRating: null,
  };

  const { coverage, missing, usesSoon } = pantryCoverage(pseudo, input.pantry, input.date);
  return {
    dishId: null,
    name: pseudo.name,
    cuisine: pseudo.cuisine,
    effortMinutes: pseudo.effortMinutes,
    reason: String(opt.reason ?? '').trim(),
    coverage,
    missing,
    usesSoon,
    tags: [],
    isNew: true,
    ingredients: pseudo.ingredients,
    steps: pseudo.steps,
  };
}

function fromScored(s: ScoredDish): Suggestion {
  return {
    dishId: s.dish.id,
    name: s.dish.name,
    cuisine: s.dish.cuisine,
    effortMinutes: s.dish.effortMinutes,
    reason: sentence(s.because),
    coverage: s.coverage,
    missing: s.missing,
    usesSoon: s.usesSoon,
    tags: s.dish.tags,
    ingredients: s.dish.ingredients,
    steps: s.dish.steps,
  };
}

function scoreContext(input: SuggestInput, date: string, plannedIds: number[] = []): ScoreContext {
  return {
    household: input.household,
    members: input.members,
    pantry: input.pantry,
    date,
    alreadyPlannedDishIds: plannedIds,
    ratings: input.ratings,
  };
}

/** Local-only answer, used when there is no API key or the call fails. */
function localSet(input: SuggestInput, ranked: ScoredDish[]): SuggestionSet {
  const options = ranked.slice(0, 3).map(fromScored);
  const soon = ranked.flatMap((r) => r.usesSoon);
  return {
    date: input.date,
    generatedBy: 'local',
    note: options.length
      ? soon.length
        ? `Ranked from your own dishes. ${soon[0]} should be used up soon.`
        : 'Ranked from your own dishes and what is in the pantry.'
      : 'Add a few dishes your family eats and this screen will start suggesting.',
    options,
  };
}

/** Three dinner options for one night. */
export async function suggestDinner(input: SuggestInput): Promise<SuggestionSet> {
  const ranked = rankDishes(input.dishes, scoreContext(input, input.date));
  const candidates = ranked.slice(0, MAX_CANDIDATES);

  if (!aiConfigured()) return localSet(input, ranked);

  const budget = [0, 6].includes(new Date(`${input.date}T12:00:00Z`).getUTCDay())
    ? input.household.weekendMinutes
    : input.household.weeknightMinutes;

  const user = [
    profileBrief(input.household, input.members),
    '',
    pantryBrief(input.pantry, input.date),
    '',
    candidateBrief(candidates),
    '',
    historyBrief(input.history),
    '',
    `Tonight is ${weekdayName(input.date)} ${input.date}. Time budget tonight: about ${budget} minutes.`,
    'Give exactly three options, best first. Prefer candidates; invent at most one new dish.',
  ].join('\n');

  const res = await askJson<{ note: string; options: RawOption[] }>({
    system: DINNER_SYSTEM,
    user,
    schemaName: 'dinner_options',
    schema: dinnerOptionsSchema as unknown as Record<string, unknown>,
  });

  if (!res?.options?.length) return localSet(input, ranked);

  const seen = new Set<string>();
  const options: Suggestion[] = [];
  for (const raw of res.options) {
    const s = materialise(raw, candidates, input);
    if (!s) continue;
    const key = normalizeName(s.name);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(s);
  }

  // Top up from the local ranking if the model returned fewer usable options.
  for (const r of ranked) {
    if (options.length >= 3) break;
    const key = normalizeName(r.dish.name);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(fromScored(r));
  }

  if (!options.length) return localSet(input, ranked);
  return { date: input.date, generatedBy: 'ai', note: String(res.note ?? '').trim(), options: options.slice(0, 3) };
}

/**
 * One dinner per day for a run of dates.
 *
 * `avoidDishIds` carries dishes already pinned to other nights in the same
 * stretch, so filling the gaps around a chosen dinner does not echo it back.
 *
 * A week of the same dinner is not a plan: each dish is used at most once in
 * the window, and once the repertoire is exhausted the remaining nights are
 * left open rather than padded with repeats.
 */
export async function suggestWeek(
  input: SuggestInput,
  dates: string[],
  avoidDishIds: number[] = [],
): Promise<SuggestionSet[]> {
  const localPlan = (): SuggestionSet[] => {
    const used: number[] = [...avoidDishIds];
    return dates.map((date) => {
      const ranked = rankDishes(input.dishes, scoreContext(input, date, used));
      const top = ranked.find((r) => !used.includes(r.dish.id));
      if (top) used.push(top.dish.id);
      return {
        date,
        generatedBy: 'local' as const,
        note: '',
        options: top ? [fromScored(top)] : [],
      };
    });
  };

  if (!aiConfigured() || !dates.length) return localPlan();

  const ranked = rankDishes(input.dishes, scoreContext(input, dates[0], avoidDishIds));
  const candidates = ranked.slice(0, MAX_CANDIDATES + 6);

  const user = [
    profileBrief(input.household, input.members),
    '',
    pantryBrief(input.pantry, dates[0]),
    '',
    candidateBrief(candidates),
    '',
    historyBrief(input.history),
    '',
    `Plan dinner for these dates, in order: ${dates.map((d) => `${d} (${weekdayName(d)})`).join(', ')}.`,
    'Spread cuisines and effort across the week: the heavy cooking goes at the weekend.',
    'Front-load dishes that use ingredients already in the pantry, especially anything near its use-by;',
    'later days may need shopping. Do not repeat a dish inside the week.',
    avoidDishIds.length
      ? `Already fixed on other nights this week, so do not pick these again: ${input.dishes
          .filter((d) => avoidDishIds.includes(d.id))
          .map((d) => d.name)
          .join(', ')}.`
      : '',
  ].filter(Boolean).join('\n');

  const res = await askJson<{ note: string; days: (RawOption & { date: string })[] }>({
    system: DINNER_SYSTEM,
    user,
    schemaName: 'week_plan',
    schema: weekPlanSchema as unknown as Record<string, unknown>,
    temperature: 0.8,
  });

  if (!res?.days?.length) return localPlan();

  const byDate = new Map(res.days.map((d) => [String(d.date), d]));
  const fallback = localPlan();
  const usedNames = new Set(
    input.dishes.filter((d) => avoidDishIds.includes(d.id)).map((d) => normalizeName(d.name)),
  );

  return dates.map((date, i) => {
    const raw = byDate.get(date);
    const s = raw ? materialise(raw, candidates, { ...input, date }) : null;
    // The model is told not to repeat inside the week; enforce it either way.
    if (!s || usedNames.has(normalizeName(s.name))) {
      const alt = fallback[i];
      const altName = alt.options[0] ? normalizeName(alt.options[0].name) : null;
      if (!altName || usedNames.has(altName)) return { ...alt, options: [] };
      usedNames.add(altName);
      return alt;
    }
    usedNames.add(normalizeName(s.name));
    return { date, generatedBy: 'ai' as const, note: i === 0 ? String(res.note ?? '') : '', options: [s] };
  });
}

/** Propose new dishes for the family's repertoire. */
export async function generateDishIdeas(
  household: Household,
  members: Member[],
  existing: Dish[],
  pantry: PantryItem[],
  count = 6,
  brief = '',
): Promise<Omit<Dish, 'id' | 'householdId' | 'normName' | 'timesCooked' | 'lastCookedAt' | 'avgRating'>[]> {
  const res = await askJson<{
    dishes: {
      name: string;
      cuisine: string;
      tags: string[];
      effortMinutes: number;
      servings: number;
      ingredients: DishIngredient[];
      steps: string[];
      notes: string;
    }[];
  }>({
    system: [
      'You are helping one family build the list of dinners they actually cook.',
      'Suggest dishes that fit their tastes, their kitchen time and the ingredients they already buy.',
      'Everyday family cooking, not restaurant food. Never include an allergen or an avoided item.',
      'Ingredient names must be plain shopping-list words so they can be matched against a pantry.',
    ].join('\n'),
    user: [
      profileBrief(household, members),
      '',
      pantryBrief(pantry, new Date().toISOString().slice(0, 10)),
      '',
      dishListBrief(existing),
      '',
      brief.trim() ? `The family asked specifically for: ${brief.trim()}` : '',
      `Propose ${count} new dishes.`,
    ]
      .filter(Boolean)
      .join('\n'),
    schemaName: 'dish_ideas',
    schema: dishIdeasSchema as unknown as Record<string, unknown>,
    temperature: 0.9,
  });

  if (!res?.dishes?.length) return [];

  return res.dishes
    .map((d) => ({
      name: String(d.name ?? '').trim(),
      cuisine: String(d.cuisine ?? '').trim(),
      tags: Array.isArray(d.tags) ? d.tags.map(String).filter(Boolean).slice(0, 6) : [],
      effortMinutes: Number(d.effortMinutes) || household.weeknightMinutes,
      servings: Number(d.servings) || household.servings,
      ingredients: cleanIngredients(d.ingredients),
      steps: Array.isArray(d.steps) ? d.steps.map(String).filter(Boolean) : [],
      notes: String(d.notes ?? ''),
      source: 'ai' as const,
      favorite: false,
      active: true,
    }))
    .filter((d) => d.name && d.ingredients.length);
}

/**
 * Turn a free-typed list ("2kg rice, milk, some tomatoes, chicken") into
 * structured pantry rows. Falls back to naive line splitting without a key.
 */
export async function parsePantryText(text: string): Promise<
  { name: string; quantity: number; unit: string; category: string; staple: boolean }[]
> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const naive = () =>
    trimmed
      .split(/[\n,;]+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^([\d.]+)\s*([a-zA-Z]*)\s+(.*)$/);
        if (m) {
          const name = m[3].trim();
          return { name, quantity: Number(m[1]) || 1, unit: canonicalUnit(m[2]), category: guessCategory(name), staple: false };
        }
        return { name: line, quantity: 1, unit: 'unit', category: guessCategory(line), staple: false };
      });

  const res = await askJson<{ items: { name: string; quantity: number; unit: string; category: string; staple: boolean }[] }>({
    system:
      'You convert a shopper\'s free-typed list into structured pantry rows. Keep the family\'s own wording for names. ' +
      'Guess a sensible quantity and unit when they did not say. Do not invent items they did not mention.',
    user: trimmed,
    schemaName: 'pantry_items',
    schema: pantryParseSchema as unknown as Record<string, unknown>,
    temperature: 0.2,
  });

  if (!res?.items?.length) return naive();

  return res.items
    .map((i) => ({
      name: String(i.name ?? '').trim(),
      quantity: Number.isFinite(Number(i.quantity)) ? Number(i.quantity) : 1,
      unit: canonicalUnit(String(i.unit ?? 'unit')),
      category: (() => {
        const given = String(i.category ?? '').toLowerCase().trim();
        return given && given !== 'other' ? given : guessCategory(String(i.name ?? ''));
      })(),
      staple: Boolean(i.staple),
    }))
    .filter((i) => i.name);
}
