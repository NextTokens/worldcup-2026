'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { getHousehold, listMembers } from '@/lib/repo/household';
import { deleteDish, listDishes, saveDish, setDishFlag, type DishInput } from '@/lib/repo/dishes';
import { listPantry } from '@/lib/repo/pantry';
import { generateDishIdeas } from '@/lib/ai/suggest';
import { aiConfigured } from '@/lib/ai/client';
import { parseIngredientLines } from '@/lib/suggest/parseIngredients';

export async function saveDishAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();

  const idRaw = String(formData.get('id') ?? '');
  const input: DishInput = {
    id: idRaw ? Number(idRaw) : undefined,
    name: String(formData.get('name') ?? ''),
    cuisine: String(formData.get('cuisine') ?? '').trim(),
    tags: String(formData.get('tags') ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    effortMinutes: Number(formData.get('effortMinutes')) || household.weeknightMinutes,
    servings: Number(formData.get('servings')) || household.servings,
    ingredients: parseIngredientLines(String(formData.get('ingredients') ?? '')),
    steps: String(formData.get('steps') ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    notes: String(formData.get('notes') ?? '').trim(),
    favorite: formData.get('favorite') === 'on',
  };
  if (!input.name.trim()) return;

  await saveDish(household.id, input);
  revalidatePath('/dishes');
  revalidatePath('/');
}

export async function toggleDishFlagAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();
  const id = Number(formData.get('id'));
  const flag = String(formData.get('flag')) === 'active' ? 'active' : 'favorite';
  const value = String(formData.get('value')) === 'true';
  if (id) await setDishFlag(household.id, id, flag, value);
  revalidatePath('/dishes');
}

export async function deleteDishAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();
  const id = Number(formData.get('id'));
  if (id) await deleteDish(household.id, id);
  revalidatePath('/dishes');
}

/**
 * Grow the family's repertoire. Everything generated is saved as an ordinary
 * dish they can then edit or delete — the app never hides what it added.
 */
export async function generateDishesAction(formData: FormData): Promise<void> {
  await requireSession();
  if (!aiConfigured()) return;

  const household = await getHousehold();
  const [members, existing, pantry] = await Promise.all([
    listMembers(household.id),
    listDishes(household.id, true),
    listPantry(household.id),
  ]);

  const count = Math.min(10, Math.max(1, Number(formData.get('count')) || 6));
  const brief = String(formData.get('brief') ?? '');

  const ideas = await generateDishIdeas(household, members, existing, pantry, count, brief);
  for (const idea of ideas) {
    await saveDish(household.id, idea);
  }

  revalidatePath('/dishes');
  revalidatePath('/');
}
