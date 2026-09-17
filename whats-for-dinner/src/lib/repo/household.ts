import 'server-only';
import { db } from '@/lib/db';
import type { Household, Member } from '@/lib/types';

/**
 * A deployment serves one family. The row is created on first use, and every
 * query is still scoped by household_id so a shared deployment stays possible
 * later without a data migration.
 */

type HouseholdRow = {
  id: number;
  name: string;
  servings: number;
  weeknight_minutes: number;
  weekend_minutes: number;
  cuisines: string[];
  avoid: string[];
  no_repeat_days: number;
  budget: string;
  shopping_day: number | null;
  notes: string;
  onboarded: boolean;
};

function toHousehold(r: HouseholdRow): Household {
  return {
    id: r.id,
    name: r.name,
    servings: r.servings,
    weeknightMinutes: r.weeknight_minutes,
    weekendMinutes: r.weekend_minutes,
    cuisines: r.cuisines ?? [],
    avoid: r.avoid ?? [],
    noRepeatDays: r.no_repeat_days,
    budget: (['low', 'medium', 'high'].includes(r.budget) ? r.budget : 'medium') as Household['budget'],
    shoppingDay: r.shopping_day,
    notes: r.notes ?? '',
    onboarded: r.onboarded,
  };
}

export async function getHousehold(): Promise<Household> {
  const sql = await db();
  const rows = await sql<HouseholdRow[]>`select * from household order by id limit 1`;
  if (rows.length) return toHousehold(rows[0]);
  const created = await sql<HouseholdRow[]>`insert into household default values returning *`;
  return toHousehold(created[0]);
}

export async function updateHousehold(id: number, patch: Partial<Household>): Promise<void> {
  const sql = await db();
  await sql`
    update household set
      name              = coalesce(${patch.name ?? null}, name),
      servings          = coalesce(${patch.servings ?? null}, servings),
      weeknight_minutes = coalesce(${patch.weeknightMinutes ?? null}, weeknight_minutes),
      weekend_minutes   = coalesce(${patch.weekendMinutes ?? null}, weekend_minutes),
      cuisines          = coalesce(${patch.cuisines ?? null}, cuisines),
      avoid             = coalesce(${patch.avoid ?? null}, avoid),
      no_repeat_days    = coalesce(${patch.noRepeatDays ?? null}, no_repeat_days),
      budget            = coalesce(${patch.budget ?? null}, budget),
      shopping_day      = ${patch.shoppingDay === undefined ? sql`shopping_day` : patch.shoppingDay},
      notes             = coalesce(${patch.notes ?? null}, notes),
      onboarded         = coalesce(${patch.onboarded ?? null}, onboarded)
    where id = ${id}
  `;
}

type MemberRow = {
  id: number;
  household_id: number;
  name: string;
  is_cook: boolean;
  likes: string[];
  dislikes: string[];
  allergies: string[];
  diet: string;
  notes: string;
  sort_order: number;
};

const toMember = (r: MemberRow): Member => ({
  id: r.id,
  householdId: r.household_id,
  name: r.name,
  isCook: r.is_cook,
  likes: r.likes ?? [],
  dislikes: r.dislikes ?? [],
  allergies: r.allergies ?? [],
  diet: r.diet ?? '',
  notes: r.notes ?? '',
  sortOrder: r.sort_order,
});

export async function listMembers(householdId: number): Promise<Member[]> {
  const sql = await db();
  const rows = await sql<MemberRow[]>`
    select * from member where household_id = ${householdId} order by sort_order, id
  `;
  return rows.map(toMember);
}

export async function upsertMember(
  householdId: number,
  m: Partial<Member> & { name: string },
): Promise<void> {
  const sql = await db();
  const payload = {
    household_id: householdId,
    name: m.name.trim(),
    is_cook: m.isCook ?? false,
    likes: m.likes ?? [],
    dislikes: m.dislikes ?? [],
    allergies: m.allergies ?? [],
    diet: m.diet ?? '',
    notes: m.notes ?? '',
    sort_order: m.sortOrder ?? 0,
  };

  if (m.id) {
    await sql`update member set ${sql(payload)} where id = ${m.id} and household_id = ${householdId}`;
    return;
  }
  await sql`insert into member ${sql(payload)}`;
}

export async function deleteMember(householdId: number, id: number): Promise<void> {
  const sql = await db();
  await sql`delete from member where id = ${id} and household_id = ${householdId}`;
}
