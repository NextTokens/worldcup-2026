import 'server-only';
import { db } from '@/lib/db';
import { displayName, normalizeName } from '@/lib/normalize';
import { canonicalUnit } from '@/lib/units';
import { guessCategory } from '@/lib/categories';
import type { PantryItem } from '@/lib/types';

type Row = {
  id: number;
  household_id: number;
  name: string;
  norm_name: string;
  category: string;
  quantity: string;
  unit: string;
  par_level: string;
  staple: boolean;
  use_by: Date | string | null;
  note: string;
  updated_at: Date | string;
};

const iso = (d: Date | string | null): string | null => {
  if (!d) return null;
  return typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
};

const toItem = (r: Row): PantryItem => ({
  id: r.id,
  householdId: r.household_id,
  name: r.name,
  normName: r.norm_name,
  category: r.category,
  quantity: Number(r.quantity),
  unit: r.unit,
  parLevel: Number(r.par_level),
  staple: r.staple,
  useBy: iso(r.use_by),
  note: r.note ?? '',
  updatedAt: typeof r.updated_at === 'string' ? r.updated_at : r.updated_at.toISOString(),
});

export async function listPantry(householdId: number): Promise<PantryItem[]> {
  const sql = await db();
  const rows = await sql<Row[]>`
    select * from pantry_item where household_id = ${householdId}
    order by category, name
  `;
  return rows.map(toItem);
}

export type PantryUpsert = {
  name: string;
  quantity?: number;
  unit?: string;
  category?: string;
  parLevel?: number;
  staple?: boolean;
  useBy?: string | null;
  note?: string;
  /** Add to the existing quantity instead of replacing it (restocking). */
  mode?: 'set' | 'add';
};

/**
 * Upsert by canonical name, so "Tomatoes" typed today lands on the same row as
 * "tomato" typed last week.
 */
export async function upsertPantryItem(householdId: number, item: PantryUpsert): Promise<void> {
  const name = displayName(item.name);
  const normName = normalizeName(name);
  if (!normName) return;

  const sql = await db();
  const quantity = Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 0;
  const unit = canonicalUnit(item.unit);

  await sql`
    insert into pantry_item
      (household_id, name, norm_name, category, quantity, unit, par_level, staple, use_by, note)
    values (
      ${householdId}, ${name}, ${normName}, ${item.category && item.category !== 'other' ? item.category : guessCategory(name)}, ${quantity}, ${unit},
      ${item.parLevel ?? 0}, ${item.staple ?? false}, ${item.useBy ?? null}, ${item.note ?? ''}
    )
    on conflict (household_id, norm_name) do update set
      name       = excluded.name,
      category   = case when excluded.category = 'other' then pantry_item.category else excluded.category end,
      quantity   = ${item.mode === 'add' ? sql`pantry_item.quantity + excluded.quantity` : sql`excluded.quantity`},
      unit       = excluded.unit,
      par_level  = greatest(excluded.par_level, pantry_item.par_level),
      staple     = excluded.staple or pantry_item.staple,
      use_by     = coalesce(excluded.use_by, pantry_item.use_by),
      note       = case when excluded.note = '' then pantry_item.note else excluded.note end,
      updated_at = now()
  `;
}

export async function setPantryQuantity(householdId: number, id: number, quantity: number): Promise<void> {
  const sql = await db();
  await sql`
    update pantry_item set quantity = ${Math.max(0, quantity)}, updated_at = now()
    where id = ${id} and household_id = ${householdId}
  `;
}

export async function deletePantryItem(householdId: number, id: number): Promise<void> {
  const sql = await db();
  await sql`delete from pantry_item where id = ${id} and household_id = ${householdId}`;
}

/**
 * Deduct a cooked dish from the pantry.
 *
 * Quantities in home cooking are approximate, so this is deliberately gentle:
 * countable amounts are subtracted, and anything we cannot compare cleanly is
 * left alone rather than wrongly zeroed. Items that fall to zero surface on the
 * shopping list through their par level.
 */
export async function consumeIngredients(
  householdId: number,
  ingredients: { name: string; quantity: number; unit: string }[],
): Promise<string[]> {
  if (!ingredients.length) return [];
  const sql = await db();
  const pantry = await listPantry(householdId);
  const emptied: string[] = [];

  for (const ing of ingredients) {
    const norm = normalizeName(ing.name);
    const match =
      pantry.find((p) => p.normName === norm) ??
      pantry.find((p) => p.normName.includes(norm) || norm.includes(p.normName));
    if (!match || match.quantity <= 0) continue;

    const sameUnit = canonicalUnit(match.unit) === canonicalUnit(ing.unit);
    const next = sameUnit && ing.quantity > 0 ? Math.max(0, match.quantity - ing.quantity) : match.quantity;

    if (next !== match.quantity) {
      await sql`
        update pantry_item set quantity = ${next}, updated_at = now() where id = ${match.id}
      `;
      match.quantity = next;
    }
    if (next <= 0) emptied.push(match.name);
  }

  return emptied;
}
