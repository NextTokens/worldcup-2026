import 'server-only';
import { db } from '@/lib/db';
import { displayName, normalizeName } from '@/lib/normalize';
import { canonicalUnit } from '@/lib/units';
import { asArray } from '@/lib/json';
import type { Dish, DishIngredient } from '@/lib/types';

type Row = {
  id: number;
  household_id: number;
  name: string;
  norm_name: string;
  cuisine: string;
  tags: string[];
  effort_minutes: number;
  servings: number;
  ingredients: DishIngredient[];
  steps: string[];
  notes: string;
  source: string;
  favorite: boolean;
  active: boolean;
  times_cooked: number;
  last_cooked_at: Date | string | null;
  avg_rating: string | null;
};

const toDish = (r: Row): Dish => ({
  id: r.id,
  householdId: r.household_id,
  name: r.name,
  normName: r.norm_name,
  cuisine: r.cuisine ?? '',
  tags: r.tags ?? [],
  effortMinutes: r.effort_minutes,
  servings: r.servings,
  ingredients: asArray<DishIngredient>(r.ingredients),
  steps: r.steps ?? [],
  notes: r.notes ?? '',
  source: (['manual', 'ai', 'seed'].includes(r.source) ? r.source : 'manual') as Dish['source'],
  favorite: r.favorite,
  active: r.active,
  timesCooked: r.times_cooked,
  lastCookedAt: r.last_cooked_at
    ? typeof r.last_cooked_at === 'string'
      ? r.last_cooked_at.slice(0, 10)
      : r.last_cooked_at.toISOString().slice(0, 10)
    : null,
  avgRating: r.avg_rating === null ? null : Number(r.avg_rating),
});

const DISH_SELECT = `
  d.*,
  (select avg(f.rating)::numeric(4,2)
     from feedback f
     join plan_entry p on p.id = f.plan_entry_id
    where p.dish_id = d.id) as avg_rating
`;

export async function listDishes(householdId: number, includeInactive = false): Promise<Dish[]> {
  const sql = await db();
  const rows = await sql<Row[]>`
    select ${sql.unsafe(DISH_SELECT)}
    from dish d
    where d.household_id = ${householdId}
      ${includeInactive ? sql`` : sql`and d.active`}
    order by d.favorite desc, d.name
  `;
  return rows.map(toDish);
}

export async function getDish(householdId: number, id: number): Promise<Dish | null> {
  const sql = await db();
  const rows = await sql<Row[]>`
    select ${sql.unsafe(DISH_SELECT)} from dish d
    where d.id = ${id} and d.household_id = ${householdId}
  `;
  return rows.length ? toDish(rows[0]) : null;
}

/** Ratings by dish id, for the scorer. */
export async function dishRatings(householdId: number): Promise<Record<number, number>> {
  const sql = await db();
  const rows = await sql<{ dish_id: number; rating: string }[]>`
    select p.dish_id, avg(f.rating)::numeric(4,2) as rating
    from feedback f
    join plan_entry p on p.id = f.plan_entry_id
    where f.household_id = ${householdId} and p.dish_id is not null
    group by p.dish_id
  `;
  return Object.fromEntries(rows.map((r) => [r.dish_id, Number(r.rating)]));
}

export type DishInput = {
  id?: number;
  name: string;
  cuisine?: string;
  tags?: string[];
  effortMinutes?: number;
  servings?: number;
  ingredients?: DishIngredient[];
  steps?: string[];
  notes?: string;
  source?: Dish['source'];
  favorite?: boolean;
  active?: boolean;
};

function cleanIngredients(list: DishIngredient[] | undefined): DishIngredient[] {
  return (list ?? [])
    .map((i) => ({
      name: displayName(i.name ?? ''),
      quantity: Number.isFinite(Number(i.quantity)) ? Number(i.quantity) : 0,
      unit: canonicalUnit(i.unit),
      optional: Boolean(i.optional),
    }))
    .filter((i) => i.name);
}

/** Insert or update a dish. Returns its id, or null when the name was empty. */
export async function saveDish(householdId: number, input: DishInput): Promise<number | null> {
  const name = displayName(input.name);
  const normName = normalizeName(name);
  if (!normName) return null;

  const sql = await db();
  const values = {
    household_id: householdId,
    name,
    norm_name: normName,
    cuisine: input.cuisine ?? '',
    tags: input.tags ?? [],
    effort_minutes: input.effortMinutes ?? 40,
    servings: input.servings ?? 4,
    // jsonb: hand postgres.js the array itself, never a pre-stringified blob.
    ingredients: sql.json(cleanIngredients(input.ingredients)),
    steps: input.steps ?? [],
    notes: input.notes ?? '',
    source: input.source ?? 'manual',
    favorite: input.favorite ?? false,
    active: input.active ?? true,
  };

  if (input.id) {
    const rows = await sql<{ id: number }[]>`
      update dish set ${sql(values)} where id = ${input.id} and household_id = ${householdId} returning id
    `;
    return rows[0]?.id ?? null;
  }

  const rows = await sql<{ id: number }[]>`
    insert into dish ${sql(values)}
    on conflict (household_id, norm_name) do update set
      ingredients = excluded.ingredients,
      steps       = case when array_length(excluded.steps, 1) is null then dish.steps else excluded.steps end,
      cuisine     = case when excluded.cuisine = '' then dish.cuisine else excluded.cuisine end,
      tags        = excluded.tags,
      active      = true
    returning id
  `;
  return rows[0]?.id ?? null;
}

export async function setDishFlag(
  householdId: number,
  id: number,
  flag: 'favorite' | 'active',
  value: boolean,
): Promise<void> {
  const sql = await db();
  if (flag === 'favorite') {
    await sql`update dish set favorite = ${value} where id = ${id} and household_id = ${householdId}`;
  } else {
    await sql`update dish set active = ${value} where id = ${id} and household_id = ${householdId}`;
  }
}

export async function deleteDish(householdId: number, id: number): Promise<void> {
  const sql = await db();
  await sql`delete from dish where id = ${id} and household_id = ${householdId}`;
}

export async function markCooked(householdId: number, dishId: number, date: string): Promise<void> {
  const sql = await db();
  await sql`
    update dish
       set times_cooked = times_cooked + 1,
           last_cooked_at = greatest(coalesce(last_cooked_at, ${date}::date), ${date}::date)
     where id = ${dishId} and household_id = ${householdId}
  `;
}
