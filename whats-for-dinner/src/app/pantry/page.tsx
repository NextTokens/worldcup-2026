import { AppShell } from '@/components/AppShell';
import { Setup } from '@/components/Setup';
import { SubmitButton } from '@/components/SubmitButton';
import { PantryRow } from '@/components/PantryRow';
import { requirePage } from '@/lib/auth';
import { databaseConfigured } from '@/lib/db';
import { getHousehold } from '@/lib/repo/household';
import { listPantry } from '@/lib/repo/pantry';
import { addPantryItemAction, quickAddPantryAction } from '@/lib/actions/pantry';
import { aiConfigured } from '@/lib/ai/client';
import { PANTRY_CATEGORIES } from '@/lib/types';
import { todayIso } from '@/lib/date';

export const dynamic = 'force-dynamic';

export default async function PantryPage() {
  await requirePage('/pantry');
  if (!databaseConfigured()) return <Setup />;

  const household = await getHousehold();
  const pantry = await listPantry(household.id);
  const today = todayIso();

  const grouped = new Map<string, typeof pantry>();
  for (const item of pantry) {
    grouped.set(item.category, [...(grouped.get(item.category) ?? []), item]);
  }

  const out = pantry.filter((p) => p.quantity <= 0);
  const soon = pantry.filter((p) => {
    if (!p.useBy || p.quantity <= 0) return false;
    return (Date.parse(`${p.useBy}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000 <= 3;
  });

  return (
    <AppShell householdName={household.name}>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">What we have</h1>
      <p className="mb-4 text-sm text-ink-soft">
        {pantry.length
          ? `${pantry.length - out.length} in stock${out.length ? `, ${out.length} run out` : ''}.`
          : 'Nothing yet — the quickest way in is to paste a list below.'}
      </p>

      {soon.length ? (
        <p className="mb-4 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
          Use soon: {soon.map((s) => s.name).join(', ')}
        </p>
      ) : null}

      {/* Keyed on the item count so the box clears once the items land. */}
      <form key={`quick-${pantry.length}`} action={quickAddPantryAction} className="card mb-4">
        <label className="label" htmlFor="quick-text">
          Quick add
        </label>
        <textarea
          id="quick-text"
          name="text"
          rows={3}
          required
          placeholder={'2kg basmati rice, milk, 6 eggs, chicken thighs, tomatoes, olive oil'}
          className="field"
        />
        <div className="mt-2 flex items-center gap-2">
          <SubmitButton pendingLabel="Sorting it out…">Add to pantry</SubmitButton>
          <span className="text-xs text-ink-soft">
            {aiConfigured()
              ? 'Type it however you like — quantities and categories are worked out for you.'
              : 'One item per line, e.g. "2 kg rice".'}
          </span>
        </div>
      </form>

      <details className="card mb-6">
        <summary className="cursor-pointer text-sm font-semibold">Add one item precisely</summary>
        <form key={`one-${pantry.length}`} action={addPantryItemAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="p-name">
              Item
            </label>
            <input id="p-name" name="name" required className="field" />
          </div>
          <div>
            <label className="label" htmlFor="p-qty">
              Quantity
            </label>
            <input id="p-qty" name="quantity" type="number" step="0.1" min="0" defaultValue={1} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="p-unit">
              Unit
            </label>
            <input id="p-unit" name="unit" defaultValue="unit" placeholder="g, kg, ml, pack" className="field" />
          </div>
          <div>
            <label className="label" htmlFor="p-cat">
              Category
            </label>
            <select id="p-cat" name="category" defaultValue="other" className="field">
              {PANTRY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="p-useby">
              Use by (optional)
            </label>
            <input id="p-useby" name="useBy" type="date" className="field" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="p-par">
              Keep at least (for the shopping list)
            </label>
            <input id="p-par" name="parLevel" type="number" step="0.1" min="0" defaultValue={0} className="field" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="staple" className="size-4" />
            We always keep this in — put it on the list when it runs low
          </label>
          <div className="sm:col-span-2">
            <SubmitButton className="btn-ghost">Add item</SubmitButton>
          </div>
        </form>
      </details>

      {[...grouped.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([category, items]) => (
          <section key={category} className="mb-5">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">{category}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {items.map((item) => (
                <PantryRow key={item.id} item={item} today={today} />
              ))}
            </ul>
          </section>
        ))}
    </AppShell>
  );
}
