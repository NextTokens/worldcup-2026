'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { deleteMember, getHousehold, updateHousehold, upsertMember } from '@/lib/repo/household';
import type { Household } from '@/lib/types';

/** Split a comma- or newline-separated field into clean terms. */
function terms(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(/[\n,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 40);
}

function num(value: FormDataEntryValue | null, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

export async function saveHouseholdAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();

  const shoppingDayRaw = String(formData.get('shoppingDay') ?? '');
  const budget = String(formData.get('budget') ?? household.budget);

  await updateHousehold(household.id, {
    name: String(formData.get('name') ?? household.name).trim() || household.name,
    servings: num(formData.get('servings'), household.servings),
    weeknightMinutes: num(formData.get('weeknightMinutes'), household.weeknightMinutes),
    weekendMinutes: num(formData.get('weekendMinutes'), household.weekendMinutes),
    noRepeatDays: num(formData.get('noRepeatDays'), household.noRepeatDays),
    cuisines: terms(formData.get('cuisines')),
    avoid: terms(formData.get('avoid')),
    budget: (['low', 'medium', 'high'].includes(budget) ? budget : household.budget) as Household['budget'],
    shoppingDay: shoppingDayRaw === '' ? null : Number(shoppingDayRaw),
    notes: String(formData.get('notes') ?? '').trim(),
  });

  revalidatePath('/', 'layout');
}

export async function saveMemberAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;

  const idRaw = String(formData.get('id') ?? '');
  await upsertMember(household.id, {
    id: idRaw ? Number(idRaw) : undefined,
    name,
    isCook: formData.get('isCook') === 'on',
    likes: terms(formData.get('likes')),
    dislikes: terms(formData.get('dislikes')),
    allergies: terms(formData.get('allergies')),
    diet: String(formData.get('diet') ?? '').trim(),
    notes: String(formData.get('notes') ?? '').trim(),
    sortOrder: Number(formData.get('sortOrder') ?? 0) || 0,
  });

  revalidatePath('/', 'layout');
}

export async function deleteMemberAction(formData: FormData): Promise<void> {
  await requireSession();
  const household = await getHousehold();
  const id = Number(formData.get('id'));
  if (id) await deleteMember(household.id, id);
  revalidatePath('/', 'layout');
}

export async function completeOnboardingAction(): Promise<void> {
  await requireSession();
  const household = await getHousehold();
  await updateHousehold(household.id, { onboarded: true });
  revalidatePath('/', 'layout');
  redirect('/');
}
