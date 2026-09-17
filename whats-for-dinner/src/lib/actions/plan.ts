'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { todayIso } from '@/lib/date';
import { getHousehold, listMembers } from '@/lib/repo/household';
import { listDishes, markCooked, saveDish } from '@/lib/repo/dishes';
import { consumeIngredients } from '@/lib/repo/pantry';
import {
  addFeedback,
  clearPlanEntry,
  clearSuggestionCache,
  getPlanEntry,
  setPlanEntry,
  setPlanStatus,
} from '@/lib/repo/plan';
import { addShoppingItem } from '@/lib/repo/shopping';
import { suggestWeek } from '@/lib/ai/suggest';
import { loadContext, loadSuggestions } from '@/lib/suggest/today';
import type { Suggestion } from '@/lib/types';

export async function shuffleSuggestionsAction(formData: FormData): Promise<void> {
  await requireSession();
  const date = String(formData.get('date') ?? todayIso());
  await loadSuggestions(date, true);
  revalidatePath('/');
  revalidatePath('/week');
}

/**
 * Lock in a dinner for a date.
 *
 * A suggestion the model invented has no dish row yet, so it is saved into the
 * family's repertoire first — that is how the list of "what we actually eat"
 * grows over time.
 */
export async function chooseDinnerAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();
  const date = String(formData.get('date') ?? todayIso());

  const payload = String(formData.get('suggestion') ?? '');
  if (!payload) return;

  let suggestion: Suggestion;
  try {
    suggestion = JSON.parse(payload) as Suggestion;
  } catch {
    return;
  }

  let dishId = suggestion.dishId ?? null;
  if (!dishId && suggestion.ingredients?.length) {
    dishId = await saveDish(household.id, {
      name: suggestion.name,
      cuisine: suggestion.cuisine,
      tags: suggestion.tags ?? [],
      effortMinutes: suggestion.effortMinutes,
      servings: household.servings,
      ingredients: suggestion.ingredients,
      steps: suggestion.steps ?? [],
      source: 'ai',
    });
  }

  await setPlanEntry(household.id, {
    date,
    dishId,
    dishName: suggestion.name,
    reason: suggestion.reason,
    missing: suggestion.missing ?? [],
    status: 'planned',
  });

  // Anything the dish needs and the pantry lacks belongs on the shopping list.
  for (const m of suggestion.missing ?? []) {
    await addShoppingItem(household.id, {
      name: m.name,
      quantity: m.quantity || 1,
      unit: m.unit,
      reason: `For ${suggestion.name} on ${date}`,
      source: 'plan',
    });
  }

  revalidatePath('/');
  revalidatePath('/week');
  revalidatePath('/shopping');
}

/** "We cooked it" — deduct from the pantry and count it in the history. */
export async function markCookedAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();
  const date = String(formData.get('date') ?? todayIso());

  const entry = await getPlanEntry(household.id, date);
  if (!entry) return;

  await setPlanStatus(household.id, date, 'cooked');

  if (entry.dishId) {
    const dishes = await listDishes(household.id, true);
    const dish = dishes.find((d) => d.id === entry.dishId);
    await markCooked(household.id, entry.dishId, date);
    if (dish) {
      const emptied = await consumeIngredients(household.id, dish.ingredients.filter((i) => !i.optional));
      // Anything we finished off goes straight onto the list.
      for (const name of emptied) {
        await addShoppingItem(household.id, { name, reason: `Ran out cooking ${dish.name}`, source: 'auto' });
      }
    }
  }

  revalidatePath('/');
  revalidatePath('/week');
  revalidatePath('/pantry');
  revalidatePath('/shopping');
}

export async function skipDinnerAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();
  const date = String(formData.get('date') ?? todayIso());
  await setPlanStatus(household.id, date, 'skipped');
  await clearSuggestionCache(household.id, date);
  revalidatePath('/');
  revalidatePath('/week');
}

export async function clearDayAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();
  const date = String(formData.get('date') ?? todayIso());
  await clearPlanEntry(household.id, date);
  await clearSuggestionCache(household.id, date);
  revalidatePath('/');
  revalidatePath('/week');
}

/** Family feedback. This is what makes next month's suggestions better. */
export async function rateDinnerAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();
  const date = String(formData.get('date') ?? todayIso());
  const rating = Number(formData.get('rating'));
  if (!rating) return;

  const entry = await getPlanEntry(household.id, date);
  if (!entry) return;

  const memberRaw = String(formData.get('memberId') ?? '');
  await addFeedback(
    household.id,
    entry.id,
    memberRaw ? Number(memberRaw) : null,
    rating,
    String(formData.get('comment') ?? '').trim(),
  );

  revalidatePath('/');
  revalidatePath('/dishes');
}

/** Fill a run of empty days in one pass. Existing choices are left alone. */
export async function planWeekAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();
  const start = String(formData.get('start') ?? todayIso());
  const days = Math.min(14, Math.max(1, Number(formData.get('days')) || 7));
  const overwrite = formData.get('overwrite') === 'on';

  const dates = Array.from({ length: days }, (_, i) =>
    new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10),
  );

  const existing = await Promise.all(dates.map((d) => getPlanEntry(household.id, d)));
  const target = dates.filter((d, i) => overwrite || !existing[i] || existing[i]?.status === 'skipped');
  if (!target.length) return;

  // Nights already decided in this stretch stay put, and their dishes are kept
  // out of the gaps so the week does not echo the same dinner twice.
  const keep = existing.filter((e): e is NonNullable<typeof e> => Boolean(e) && !target.includes(e!.planDate));
  const avoidDishIds = keep.map((e) => e.dishId).filter((id): id is number => id !== null);

  const input = await loadContext(target[0]);
  const sets = await suggestWeek(input, target, avoidDishIds);

  for (const set of sets) {
    const option = set.options[0];
    if (!option) continue;

    let dishId = option.dishId ?? null;
    if (!dishId && option.ingredients?.length) {
      dishId = await saveDish(household.id, {
        name: option.name,
        cuisine: option.cuisine,
        tags: option.tags ?? [],
        effortMinutes: option.effortMinutes,
        servings: household.servings,
        ingredients: option.ingredients,
        steps: option.steps ?? [],
        source: 'ai',
      });
    }

    await setPlanEntry(household.id, {
      date: set.date,
      dishId,
      dishName: option.name,
      reason: option.reason,
      missing: option.missing ?? [],
      status: 'planned',
    });
  }

  revalidatePath('/week');
  revalidatePath('/');
  revalidatePath('/shopping');
}
