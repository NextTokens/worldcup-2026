'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { getHousehold } from '@/lib/repo/household';
import {
  deletePantryItem,
  setPantryQuantity,
  upsertPantryItem,
  type PantryUpsert,
} from '@/lib/repo/pantry';
import { parsePantryText } from '@/lib/ai/suggest';
import { clearSuggestionCache } from '@/lib/repo/plan';
import { todayIso } from '@/lib/date';

/** Changing the pantry invalidates today's suggestions — they were based on it. */
async function touched(householdId: number) {
  await clearSuggestionCache(householdId, todayIso());
  revalidatePath('/pantry');
  revalidatePath('/');
  revalidatePath('/shopping');
}

export async function addPantryItemAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();

  const item: PantryUpsert = {
    name: String(formData.get('name') ?? ''),
    quantity: Number(formData.get('quantity') ?? 1),
    unit: String(formData.get('unit') ?? 'unit'),
    category: String(formData.get('category') ?? 'other'),
    parLevel: Number(formData.get('parLevel') ?? 0) || 0,
    staple: formData.get('staple') === 'on',
    useBy: String(formData.get('useBy') ?? '') || null,
    note: String(formData.get('note') ?? ''),
  };
  if (!item.name.trim()) return;

  await upsertPantryItem(household.id, item);
  await touched(household.id);
}

/**
 * "We just got back from the shop" — paste or dictate a list and let the model
 * turn it into rows. Works without a key too, just more literally.
 */
export async function quickAddPantryAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();
  const text = String(formData.get('text') ?? '');
  if (!text.trim()) return;

  const parsed = await parsePantryText(text);
  for (const item of parsed) {
    await upsertPantryItem(household.id, { ...item, mode: 'add' });
  }
  await touched(household.id);
}

export async function setPantryQuantityAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();
  const id = Number(formData.get('id'));
  const quantity = Number(formData.get('quantity'));
  if (!id || !Number.isFinite(quantity)) return;

  await setPantryQuantity(household.id, id, quantity);
  await touched(household.id);
}

/** +1 / -1 buttons on the pantry list. */
export async function nudgePantryAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();
  const id = Number(formData.get('id'));
  const current = Number(formData.get('current'));
  const delta = Number(formData.get('delta'));
  if (!id || !Number.isFinite(current) || !Number.isFinite(delta)) return;

  await setPantryQuantity(household.id, id, Math.max(0, current + delta));
  await touched(household.id);
}

export async function deletePantryItemAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();
  const id = Number(formData.get('id'));
  if (id) await deletePantryItem(household.id, id);
  await touched(household.id);
}
