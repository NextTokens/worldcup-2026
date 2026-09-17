import { AppShell } from '@/components/AppShell';
import { Setup } from '@/components/Setup';
import { SubmitButton } from '@/components/SubmitButton';
import { DishForm, IngredientSummary } from '@/components/DishForm';
import { requirePage } from '@/lib/auth';
import { databaseConfigured } from '@/lib/db';
import { getHousehold } from '@/lib/repo/household';
import { listDishes } from '@/lib/repo/dishes';
import { deleteDishAction, generateDishesAction, toggleDishFlagAction } from '@/lib/actions/dishes';
import { aiConfigured } from '@/lib/ai/client';

export const dynamic = 'force-dynamic';

export default async function DishesPage() {
  await requirePage('/dishes');
  if (!databaseConfigured()) return <Setup />;

  const household = await getHousehold();
  const dishes = await listDishes(household.id, true);
  const defaults = { servings: household.servings, minutes: household.weeknightMinutes };

  return (
    <AppShell householdName={household.name}>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Dishes we cook</h1>
      <p className="mb-4 text-sm text-ink-soft">
        This is the list the app chooses from. It is yours — edit anything, delete anything.
      </p>

      {aiConfigured() ? (
        <form action={generateDishesAction} className="card mb-4">
          <label className="label" htmlFor="gen-brief">
            Ask for ideas
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <input
              id="gen-brief"
              name="brief"
              placeholder="quick weeknight things using the rice and chicken we always have"
              className="field min-w-48 flex-1"
            />
            <div className="w-20">
              <label className="label" htmlFor="gen-count">
                How many
              </label>
              <input id="gen-count" name="count" type="number" min={1} max={10} defaultValue={6} className="field" />
            </div>
            <SubmitButton pendingLabel="Thinking…">Suggest dishes</SubmitButton>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Ideas are saved straight into this list so you can edit them like any other dish.
          </p>
        </form>
      ) : null}

      <details className="card mb-6">
        <summary className="cursor-pointer text-sm font-semibold">Add a dish yourself</summary>
        <div className="mt-3">
          {/* Keyed on the count so it remounts empty after each dish is added. */}
          <DishForm key={`new-${dishes.length}`} defaults={defaults} />
        </div>
      </details>

      {dishes.length === 0 ? (
        <p className="card text-center text-sm text-ink-soft">
          Start with five or six dinners you already make most weeks. That is enough for the app to be useful.
        </p>
      ) : null}

      <ul className="space-y-3">
        {dishes.map((dish) => (
          <li key={dish.id} className={`card ${dish.active ? '' : 'opacity-60'}`}>
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-bold">
                  {dish.favorite ? '★ ' : ''}
                  {dish.name}
                </h2>
                <p className="text-xs text-ink-soft">
                  {[
                    dish.cuisine || null,
                    `${dish.effortMinutes} min`,
                    `serves ${dish.servings}`,
                    dish.timesCooked ? `cooked ${dish.timesCooked}×` : 'not cooked yet',
                    dish.lastCookedAt ? `last ${dish.lastCookedAt}` : null,
                    dish.avgRating ? `${dish.avgRating}/5` : null,
                    dish.source === 'ai' ? 'suggested' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <IngredientSummary dish={dish} />
              </div>

              <div className="flex shrink-0 gap-1">
                <form action={toggleDishFlagAction}>
                  <input type="hidden" name="id" value={dish.id} />
                  <input type="hidden" name="flag" value="favorite" />
                  <input type="hidden" name="value" value={String(!dish.favorite)} />
                  <SubmitButton className="btn-quiet" title="Toggle favourite">
                    {dish.favorite ? 'Unfavourite' : 'Favourite'}
                  </SubmitButton>
                </form>
                <form action={toggleDishFlagAction}>
                  <input type="hidden" name="id" value={dish.id} />
                  <input type="hidden" name="flag" value="active" />
                  <input type="hidden" name="value" value={String(!dish.active)} />
                  <SubmitButton className="btn-quiet" title="Stop suggesting this for a while">
                    {dish.active ? 'Rest' : 'Bring back'}
                  </SubmitButton>
                </form>
                <form action={deleteDishAction}>
                  <input type="hidden" name="id" value={dish.id} />
                  <SubmitButton className="btn-quiet" confirm={`Delete ${dish.name}?`}>
                    ✕
                  </SubmitButton>
                </form>
              </div>
            </div>

            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold text-ink-soft">Edit</summary>
              <div className="mt-3">
                <DishForm dish={dish} defaults={defaults} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
