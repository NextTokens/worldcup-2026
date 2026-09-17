import 'server-only';
import { db } from '@/lib/db';
import { displayName, normalizeName } from '@/lib/normalize';
import { canonicalUnit } from '@/lib/units';
import { guessCategory } from '@/lib/categories';
import type { ShoppingItem } from '@/lib/types';
import type { ProposedItem } from '@/lib/suggest/shopping';

type Row = {
  id: number;
  household_id: number;
  name: string;
  norm_name: string;
  category: string;
  quantity: string;
  unit: string;
  status: string;
  reason: string;
  source: string;
  created_at: Date | string;
};

const toItem = (r: Row): ShoppingItem => ({
  id: r.id,
  householdId: r.household_id,
  name: r.name,
  normName: r.norm_name,
  category: r.category,
  quantity: Number(r.quantity),
  unit: r.unit,
  status: r.status === 'bought' ? 'bought' : 'needed',
  reason: r.reason ?? '',
  source: (['manual', 'auto', 'plan'].includes(r.source) ? r.source : 'manual') as ShoppingItem['source'],
  createdAt: typeof r.created_at === 'string' ? r.created_at : r.created_at.toISOString(),
});

export async function listShopping(householdId: number): Promise<ShoppingItem[]> {
  const sql = await db();
  const rows = await sql<Row[]>`
    select * from shopping_item
    where household_id = ${householdId}
      and (status = 'needed' or bought_at > now() - interval '2 days')
    order by status, category, name
  `;
  return rows.map(toItem);
}

export async function addShoppingItem(
  householdId: number,
  item: { name: string; quantity?: number; unit?: string; category?: string; reason?: string; source?: ShoppingItem['source'] },
): Promise<void> {
  const name = displayName(item.name);
  const normName = normalizeName(name);
  if (!normName) return;

  const sql = await db();
  await sql`
    insert into shopping_item (household_id, name, norm_name, category, quantity, unit, reason, source)
    values (
      ${householdId}, ${name}, ${normName}, ${item.category && item.category !== 'other' ? item.category : guessCategory(name)},
      ${item.quantity ?? 1}, ${canonicalUnit(item.unit)}, ${item.reason ?? ''}, ${item.source ?? 'manual'}
    )
    on conflict (household_id, norm_name) where status = 'needed'
    do update set
      quantity = greatest(shopping_item.quantity, excluded.quantity),
      reason   = case when shopping_item.reason = '' then excluded.reason else shopping_item.reason end
  `;
}

/** Persist a generated list. Returns how many lines were actually new. */
export async function addProposed(householdId: number, proposed: ProposedItem[]): Promise<number> {
  if (!proposed.length) return 0;
  const sql = await db();
  const open = await sql<{ norm_name: string }[]>`
    select norm_name from shopping_item where household_id = ${householdId} and status = 'needed'
  `;
  const existing = new Set(open.map((r) => r.norm_name));

  const fresh = proposed.filter((p) => p.normName && !existing.has(p.normName));
  if (!fresh.length) return 0;

  await sql`
    insert into shopping_item ${sql(
      fresh.map((p) => ({
        household_id: householdId,
        name: p.name,
        norm_name: p.normName,
        category: p.category,
        quantity: p.quantity,
        unit: canonicalUnit(p.unit),
        reason: p.reason,
        source: p.source,
      })),
    )}
    on conflict (household_id, norm_name) where status = 'needed' do nothing
  `;
  return fresh.length;
}

export async function setShoppingStatus(
  householdId: number,
  id: number,
  status: 'needed' | 'bought',
): Promise<void> {
  const sql = await db();
  await sql`
    update shopping_item
       set status = ${status}, bought_at = ${status === 'bought' ? sql`now()` : sql`null`}
     where id = ${id} and household_id = ${householdId}
  `;
}

export async function deleteShoppingItem(householdId: number, id: number): Promise<void> {
  const sql = await db();
  await sql`delete from shopping_item where id = ${id} and household_id = ${householdId}`;
}

/** Everything ticked off goes back onto the shelf. */
export async function boughtItems(householdId: number): Promise<ShoppingItem[]> {
  const sql = await db();
  const rows = await sql<Row[]>`
    select * from shopping_item where household_id = ${householdId} and status = 'bought'
  `;
  return rows.map(toItem);
}

export async function clearBought(householdId: number): Promise<void> {
  const sql = await db();
  await sql`delete from shopping_item where household_id = ${householdId} and status = 'bought'`;
}
