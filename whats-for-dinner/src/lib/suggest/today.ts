import 'server-only';
import { getHousehold, listMembers } from '@/lib/repo/household';
import { dishRatings, listDishes } from '@/lib/repo/dishes';
import { listPantry } from '@/lib/repo/pantry';
import { clearSuggestionCache, readSuggestionCache, recentPlan, writeSuggestionCache } from '@/lib/repo/plan';
import { suggestDinner, type SuggestInput } from '@/lib/ai/suggest';
import type { SuggestionSet } from '@/lib/types';

/**
 * Everything the recommender needs about this family, in one read.
 * Kept out of the server-action module so it is not callable from the browser.
 */
export async function loadContext(date: string): Promise<SuggestInput> {
  const household = await getHousehold();
  const [members, pantry, dishes, history, ratings] = await Promise.all([
    listMembers(household.id),
    listPantry(household.id),
    listDishes(household.id),
    recentPlan(household.id),
    dishRatings(household.id),
  ]);
  return { household, members, pantry, dishes, history, ratings, date };
}

/**
 * Tonight's options. The cached set is reused for the rest of the day so that
 * opening the app repeatedly does not spend an API call each time; `force` is
 * what the "Show me other ideas" button sends.
 */
export async function loadSuggestions(date: string, force = false): Promise<SuggestionSet> {
  const household = await getHousehold();
  if (force) {
    await clearSuggestionCache(household.id, date);
  } else {
    const cached = await readSuggestionCache(household.id, date);
    if (cached?.options?.length) return cached;
  }

  const input = await loadContext(date);
  const set = await suggestDinner(input);
  await writeSuggestionCache(household.id, date, set);
  return set;
}
