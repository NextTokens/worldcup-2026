import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { ChosenDinner } from '@/components/ChosenDinner';
import { SuggestionCard } from '@/components/SuggestionCard';
import { SubmitButton } from '@/components/SubmitButton';
import { Setup } from '@/components/Setup';
import { requirePage } from '@/lib/auth';
import { databaseConfigured } from '@/lib/db';
import { getHousehold, listMembers } from '@/lib/repo/household';
import { listDishes } from '@/lib/repo/dishes';
import { listPantry } from '@/lib/repo/pantry';
import { getPlanEntry, listFeedback } from '@/lib/repo/plan';
import { loadSuggestions } from '@/lib/suggest/today';
import { shuffleSuggestionsAction } from '@/lib/actions/plan';
import { todayIso, weekdayLong } from '@/lib/date';

export const dynamic = 'force-dynamic';

export default async function TonightPage() {
  await requirePage('/');
  if (!databaseConfigured()) return <Setup />;

  const household = await getHousehold();
  if (!household.onboarded) redirect('/onboarding');

  const date = todayIso();
  const [members, pantry, dishes, entry] = await Promise.all([
    listMembers(household.id),
    listPantry(household.id),
    listDishes(household.id),
    getPlanEntry(household.id, date),
  ]);

  const decided = entry && entry.status !== 'skipped';
  const dish = decided && entry.dishId ? (dishes.find((d) => d.id === entry.dishId) ?? null) : null;
  const feedback = decided ? await listFeedback(household.id, entry.id) : [];

  // Only spend a suggestion round-trip when there is nothing decided yet.
  const suggestions = decided ? null : await loadSuggestions(date);
  const inStock = pantry.filter((p) => p.quantity > 0).length;

  return (
    <AppShell householdName={household.name}>
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {weekdayLong(date)} dinner
        </h1>
        <p className="text-sm text-ink-soft">
          {inStock} things in the pantry · cooking for {household.servings}
        </p>
      </div>

      {decided && entry ? (
        <ChosenDinner entry={entry} dish={dish} members={members} feedback={feedback} />
      ) : (
        <>
          {suggestions?.note ? (
            <p className="mb-3 rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-soft">{suggestions.note}</p>
          ) : null}

          {suggestions?.options.length ? (
            <div className="space-y-3">
              {suggestions.options.map((s, i) => (
                <SuggestionCard key={`${s.name}-${i}`} suggestion={s} date={date} rank={i} />
              ))}
            </div>
          ) : (
            <EmptyState hasDishes={dishes.length > 0} hasPantry={pantry.length > 0} />
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <form action={shuffleSuggestionsAction}>
              <input type="hidden" name="date" value={date} />
              <SubmitButton className="btn-ghost" pendingLabel="Thinking…">
                Show me other ideas
              </SubmitButton>
            </form>
            <Link href="/pantry" className="btn-quiet">
              Update what we have
            </Link>
          </div>
        </>
      )}

      {dishes.length ? (
        <p className="mt-6 text-center text-xs text-ink-soft">
          Suggestions come from your {dishes.length} saved dish{dishes.length === 1 ? '' : 'es'} and what is in your
          pantry.
        </p>
      ) : null}
    </AppShell>
  );
}

function EmptyState({ hasDishes, hasPantry }: { hasDishes: boolean; hasPantry: boolean }) {
  return (
    <div className="card text-center">
      <p className="text-sm text-ink-soft">
        {!hasDishes
          ? 'Tell the app a few dinners your family actually eats and it can start choosing for you.'
          : !hasPantry
            ? 'Add what you have in the kitchen and suggestions will be based on it.'
            : 'Nothing fits tonight — try relaxing the time budget on the Family page, or top up the pantry.'}
      </p>
      <div className="mt-3 flex justify-center gap-2">
        <Link href="/dishes" className="btn-primary">
          Add our dishes
        </Link>
        <Link href="/pantry" className="btn-ghost">
          Add pantry
        </Link>
      </div>
    </div>
  );
}
