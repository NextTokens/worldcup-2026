import { AppShell } from '@/components/AppShell';
import { Setup } from '@/components/Setup';
import { SubmitButton } from '@/components/SubmitButton';
import { requirePage } from '@/lib/auth';
import { databaseConfigured } from '@/lib/db';
import { getHousehold } from '@/lib/repo/household';
import { listShopping } from '@/lib/repo/shopping';
import {
  addShoppingItemAction,
  buildShoppingListAction,
  deleteShoppingItemAction,
  putAwayShoppingAction,
  toggleShoppingItemAction,
} from '@/lib/actions/shopping';
import { formatAmount } from '@/lib/units';
import { todayIso } from '@/lib/date';
import { PANTRY_CATEGORIES } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ShoppingPage() {
  await requirePage('/shopping');
  if (!databaseConfigured()) return <Setup />;

  const household = await getHousehold();
  const items = await listShopping(household.id);
  const needed = items.filter((i) => i.status === 'needed');
  const bought = items.filter((i) => i.status === 'bought');

  const grouped = new Map<string, typeof needed>();
  for (const item of needed) {
    grouped.set(item.category, [...(grouped.get(item.category) ?? []), item]);
  }

  return (
    <AppShell householdName={household.name}>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Shopping</h1>
      <p className="mb-4 text-sm text-ink-soft">
        {needed.length ? `${needed.length} to buy` : 'Nothing on the list.'}
        {bought.length ? ` · ${bought.length} in the trolley` : ''}
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <form action={buildShoppingListAction}>
          <input type="hidden" name="start" value={todayIso()} />
          <input type="hidden" name="days" value={7} />
          <SubmitButton pendingLabel="Working it out…">Build list for the week</SubmitButton>
        </form>
        {bought.length ? (
          <form action={putAwayShoppingAction}>
            <SubmitButton className="btn-ghost" pendingLabel="Putting away…">
              Put away {bought.length} bought
            </SubmitButton>
          </form>
        ) : null}
      </div>

      <form
        key={`add-${items.length}`}
        action={addShoppingItemAction}
        className="card mb-6 flex flex-wrap items-end gap-2"
      >
        <div className="min-w-40 flex-1">
          <label className="label" htmlFor="s-name">
            Add something
          </label>
          <input id="s-name" name="name" required placeholder="Kitchen roll" className="field" />
        </div>
        <div className="w-20">
          <label className="label" htmlFor="s-qty">
            Qty
          </label>
          <input id="s-qty" name="quantity" type="number" step="0.1" min="0" defaultValue={1} className="field" />
        </div>
        <div className="w-24">
          <label className="label" htmlFor="s-unit">
            Unit
          </label>
          <input id="s-unit" name="unit" defaultValue="unit" className="field" />
        </div>
        <div className="w-32">
          <label className="label" htmlFor="s-cat">
            Aisle
          </label>
          <select id="s-cat" name="category" defaultValue="other" className="field">
            {PANTRY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton className="btn-ghost">Add</SubmitButton>
      </form>

      {needed.length === 0 && bought.length === 0 ? (
        <p className="card text-center text-sm text-ink-soft">
          Build the list and the app will add staples that are running low plus anything this week&rsquo;s dinners need.
        </p>
      ) : null}

      {[...grouped.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([category, group]) => (
          <section key={category} className="mb-5">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">{category}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {group.map((item) => (
                <li key={item.id} className="flex items-center gap-2 px-3 py-2.5">
                  <form action={toggleShoppingItemAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="status" value="bought" />
                    <SubmitButton className="btn-ghost size-8 rounded-lg p-0" title={`Mark ${item.name} as bought`}>
                      ○
                    </SubmitButton>
                  </form>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {item.name}
                      <span className="ml-2 text-xs font-normal text-ink-soft">
                        {formatAmount(item.quantity, item.unit)}
                      </span>
                    </p>
                    {item.reason ? <p className="truncate text-xs text-ink-soft">{item.reason}</p> : null}
                  </div>
                  <form action={deleteShoppingItemAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <SubmitButton className="btn-quiet">✕</SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ))}

      {bought.length ? (
        <section className="mb-5">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">In the trolley</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface-2">
            {bought.map((item) => (
              <li key={item.id} className="flex items-center gap-2 px-3 py-2.5">
                <form action={toggleShoppingItemAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="status" value="needed" />
                  <SubmitButton className="btn-ghost size-8 rounded-lg p-0" title={`Put ${item.name} back`}>
                    ✓
                  </SubmitButton>
                </form>
                <p className="min-w-0 flex-1 truncate text-sm text-ink-soft line-through">
                  {item.name} <span className="text-xs">{formatAmount(item.quantity, item.unit)}</span>
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-soft">
            &ldquo;Put away&rdquo; moves these into your pantry and clears them off the list.
          </p>
        </section>
      ) : null}
    </AppShell>
  );
}
