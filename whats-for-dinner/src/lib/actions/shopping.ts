'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { addDays, todayIso } from '@/lib/date';
import { getHousehold } from '@/lib/repo/household';
import { listDishes } from '@/lib/repo/dishes';
import { listPantry, upsertPantryItem } from '@/lib/repo/pantry';
import { listPlanRange } from '@/lib/repo/plan';
import {
  addProposed,
  addShoppingItem,
  boughtItems,
  clearBought,
  deleteShoppingItem,
  listShopping,
  setShoppingStatus,
} from '@/lib/repo/shopping';
import { buildShoppingList } from '@/lib/suggest/shopping';

/**
 * Build the replenishment list: staples below par, plus whatever the planned
 * dinners need and the pantry cannot cover.
 */
export async function buildShoppingListAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();

  const start = String(formData.get('start') ?? todayIso());
  const days = Math.min(21, Math.max(1, Number(formData.get('days')) || 7));

  const [pantry, dishes, plan, existing] = await Promise.all([
    listPantry(household.id),
    listDishes(household.id, true),
    listPlanRange(household.id, start, addDays(start, days - 1)),
    listShopping(household.id),
  ]);

  const byId = new Map(dishes.map((d) => [d.id, d]));
  const plannedDishes = plan
    .filter((p) => p.status !== 'skipped' && p.dishId !== null)
    .map((p) => ({ dish: byId.get(p.dishId as number), date: p.planDate }))
    .filter((p): p is { dish: (typeof dishes)[number]; date: string } => Boolean(p.dish));

  const proposed = buildShoppingList({
    pantry,
    plannedDishes,
    existing: existing.filter((e) => e.status === 'needed'),
  });

  await addProposed(household.id, proposed);
  revalidatePath('/shopping');
}

export async function addShoppingItemAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();
  const name = String(formData.get('name') ?? '');
  if (!name.trim()) return;

  await addShoppingItem(household.id, {
    name,
    quantity: Number(formData.get('quantity')) || 1,
    unit: String(formData.get('unit') ?? 'unit'),
    category: String(formData.get('category') ?? 'other'),
    source: 'manual',
  });
  revalidatePath('/shopping');
}

export async function toggleShoppingItemAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();
  const id = Number(formData.get('id'));
  const status = String(formData.get('status')) === 'bought' ? 'bought' : 'needed';
  if (id) await setShoppingStatus(household.id, id, status);
  revalidatePath('/shopping');
}

export async function deleteShoppingItemAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();
  const id = Number(formData.get('id'));
  if (id) await deleteShoppingItem(household.id, id);
  revalidatePath('/shopping');
}

/**
 * "Home from the shop": everything ticked off moves into the pantry and comes
 * off the list. Quantities are added to what is already on the shelf.
 */
export async function putAwayShoppingAction(): Promise<void> {
  await requireSession();
  const household = await getHousehold();
  const bought = await boughtItems(household.id);

  for (const item of bought) {
    await upsertPantryItem(household.id, {
      name: item.name,
      quantity: item.quantity || 1,
      unit: item.unit,
      category: item.category,
      mode: 'add',
    });
  }

  await clearBought(household.id);
  revalidatePath('/shopping');
  revalidatePath('/pantry');
  revalidatePath('/');
}
