import 'server-only';
import { db } from '@/lib/db';
import { asArray, asObject } from '@/lib/json';
import type { Feedback, MissingIngredient, PlanEntry, PlanStatus, SuggestionSet } from '@/lib/types';

type Row = {
  id: number;
  household_id: number;
  plan_date: Date | string;
  dish_id: number | null;
  dish_name: string;
  status: string;
  reason: string;
  missing: MissingIngredient[];
  cooked_at: Date | string | null;
};

const dateStr = (d: Date | string): string => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));

const toEntry = (r: Row): PlanEntry => ({
  id: r.id,
  householdId: r.household_id,
  planDate: dateStr(r.plan_date),
  dishId: r.dish_id,
  dishName: r.dish_name,
  status: (['planned', 'cooked', 'skipped'].includes(r.status) ? r.status : 'planned') as PlanStatus,
  reason: r.reason ?? '',
  missing: asArray<MissingIngredient>(r.missing),
  cookedAt: r.cooked_at ? (typeof r.cooked_at === 'string' ? r.cooked_at : r.cooked_at.toISOString()) : null,
});

export async function getPlanEntry(householdId: number, date: string): Promise<PlanEntry | null> {
  const sql = await db();
  const rows = await sql<Row[]>`
    select * from plan_entry where household_id = ${householdId} and plan_date = ${date}::date
  `;
  return rows.length ? toEntry(rows[0]) : null;
}

export async function listPlanRange(householdId: number, from: string, to: string): Promise<PlanEntry[]> {
  const sql = await db();
  const rows = await sql<Row[]>`
    select * from plan_entry
    where household_id = ${householdId} and plan_date between ${from}::date and ${to}::date
    order by plan_date
  `;
  return rows.map(toEntry);
}

/** Most recent dinners, newest first — used as history in prompts and scoring. */
export async function recentPlan(householdId: number, limit = 14): Promise<PlanEntry[]> {
  const sql = await db();
  const rows = await sql<Row[]>`
    select * from plan_entry
    where household_id = ${householdId} and plan_date <= current_date
    order by plan_date desc
    limit ${limit}
  `;
  return rows.map(toEntry);
}

export async function setPlanEntry(
  householdId: number,
  entry: {
    date: string;
    dishId: number | null;
    dishName: string;
    reason?: string;
    missing?: MissingIngredient[];
    status?: PlanStatus;
  },
): Promise<number> {
  const sql = await db();
  const rows = await sql<{ id: number }[]>`
    insert into plan_entry (household_id, plan_date, dish_id, dish_name, status, reason, missing)
    values (
      ${householdId}, ${entry.date}::date, ${entry.dishId}, ${entry.dishName},
      ${entry.status ?? 'planned'}, ${entry.reason ?? ''}, ${sql.json(entry.missing ?? [])}
    )
    on conflict (household_id, plan_date) do update set
      dish_id   = excluded.dish_id,
      dish_name = excluded.dish_name,
      status    = excluded.status,
      reason    = excluded.reason,
      missing   = excluded.missing
    returning id
  `;
  return rows[0].id;
}

export async function setPlanStatus(householdId: number, date: string, status: PlanStatus): Promise<void> {
  const sql = await db();
  await sql`
    update plan_entry
       set status = ${status},
           cooked_at = ${status === 'cooked' ? sql`now()` : sql`null`}
     where household_id = ${householdId} and plan_date = ${date}::date
  `;
}

export async function clearPlanEntry(householdId: number, date: string): Promise<void> {
  const sql = await db();
  await sql`delete from plan_entry where household_id = ${householdId} and plan_date = ${date}::date`;
}

/* ---------------------------------------------------------------- feedback */

export async function addFeedback(
  householdId: number,
  planEntryId: number,
  memberId: number | null,
  rating: number,
  comment: string,
): Promise<void> {
  const sql = await db();
  await sql`
    insert into feedback (household_id, plan_entry_id, member_id, rating, comment)
    values (${householdId}, ${planEntryId}, ${memberId}, ${Math.min(5, Math.max(1, Math.round(rating)))}, ${comment})
  `;
}

export async function listFeedback(householdId: number, planEntryId: number): Promise<Feedback[]> {
  const sql = await db();
  const rows = await sql<
    { id: number; plan_entry_id: number; member_id: number | null; name: string | null; rating: number; comment: string; created_at: Date | string }[]
  >`
    select f.id, f.plan_entry_id, f.member_id, m.name, f.rating, f.comment, f.created_at
    from feedback f
    left join member m on m.id = f.member_id
    where f.household_id = ${householdId} and f.plan_entry_id = ${planEntryId}
    order by f.created_at
  `;
  return rows.map((r) => ({
    id: r.id,
    planEntryId: r.plan_entry_id,
    memberId: r.member_id,
    memberName: r.name ?? 'Someone',
    rating: r.rating,
    comment: r.comment ?? '',
    createdAt: typeof r.created_at === 'string' ? r.created_at : r.created_at.toISOString(),
  }));
}

/* ------------------------------------------------------- suggestion caching */

/** Suggestions cost an API call, so they are kept for the day they belong to. */
export async function readSuggestionCache(householdId: number, date: string): Promise<SuggestionSet | null> {
  const sql = await db();
  const rows = await sql<{ payload: SuggestionSet }[]>`
    select payload from suggestion_cache
    where household_id = ${householdId} and plan_date = ${date}::date
  `;
  return rows.length ? asObject<SuggestionSet>(rows[0].payload) : null;
}

export async function writeSuggestionCache(householdId: number, date: string, payload: SuggestionSet): Promise<void> {
  const sql = await db();
  await sql`
    insert into suggestion_cache (household_id, plan_date, payload)
    values (${householdId}, ${date}::date, ${sql.json(payload)})
    on conflict (household_id, plan_date) do update set payload = excluded.payload, created_at = now()
  `;
}

export async function clearSuggestionCache(householdId: number, date: string): Promise<void> {
  const sql = await db();
  await sql`delete from suggestion_cache where household_id = ${householdId} and plan_date = ${date}::date`;
}
