import Link from 'next/link';
import { Setup } from '@/components/Setup';
import { SubmitButton } from '@/components/SubmitButton';
import { HouseholdForm } from '@/components/HouseholdForm';
import { MemberForm } from '@/components/MemberForm';
import { DishForm } from '@/components/DishForm';
import { requirePage } from '@/lib/auth';
import { databaseConfigured } from '@/lib/db';
import { getHousehold, listMembers } from '@/lib/repo/household';
import { listDishes } from '@/lib/repo/dishes';
import { listPantry } from '@/lib/repo/pantry';
import { quickAddPantryAction } from '@/lib/actions/pantry';
import { generateDishesAction } from '@/lib/actions/dishes';
import { completeOnboardingAction } from '@/lib/actions/family';
import { aiConfigured } from '@/lib/ai/client';

export const dynamic = 'force-dynamic';

/**
 * First-run setup. Every step writes immediately, so the family can stop
 * halfway and come back — nothing is held in browser state.
 */
export default async function OnboardingPage() {
  await requirePage('/onboarding');
  if (!databaseConfigured()) return <Setup />;

  const household = await getHousehold();
  const [members, pantry, dishes] = await Promise.all([
    listMembers(household.id),
    listPantry(household.id),
    listDishes(household.id, true),
  ]);

  const ready = members.length > 0 && dishes.length > 0;

  return (
    <main className="page">
      <header className="mb-6">
        <p aria-hidden className="text-4xl">
          🍲
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Set up your kitchen</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Four short steps. After this, the app answers &ldquo;what&rsquo;s for dinner?&rdquo; from what you actually
          have in.
        </p>
      </header>

      <Step n={1} title="Your household" done>
        <HouseholdForm household={household} />
      </Step>

      <Step n={2} title="Who eats" done={members.length > 0}>
        <div className="space-y-3">
          {members.map((m, i) => (
            <MemberForm key={m.id} member={m} index={i} />
          ))}
          {/* Keyed on the count so it remounts empty after each person is added. */}
          <MemberForm key={`new-${members.length}`} index={members.length} />
        </div>
      </Step>

      <Step n={3} title="What you have right now" done={pantry.length > 0}>
        <form key={`quick-${pantry.length}`} action={quickAddPantryAction} className="card">
          <label className="label" htmlFor="on-pantry">
            Paste your kitchen
          </label>
          <textarea
            id="on-pantry"
            name="text"
            rows={5}
            required
            placeholder={'rice, pasta, tinned tomatoes, onions, garlic, eggs, milk, chicken thighs, frozen peas, olive oil'}
            className="field"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SubmitButton pendingLabel="Sorting it out…">Add to pantry</SubmitButton>
            <span className="text-xs text-ink-soft">
              {pantry.length ? `${pantry.length} items so far.` : 'Staples first — you can refine later.'}
            </span>
          </div>
        </form>
      </Step>

      <Step n={4} title="Dinners you already cook" done={dishes.length > 0}>
        {aiConfigured() ? (
          <form action={generateDishesAction} className="card mb-3">
            <label className="label" htmlFor="on-brief">
              Describe how your family eats and get a starting list
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <input
                id="on-brief"
                name="brief"
                placeholder="mostly Levantine and Italian, kids are fussy, weeknights under 40 minutes"
                className="field min-w-48 flex-1"
              />
              <input type="hidden" name="count" value={8} />
              <SubmitButton pendingLabel="Thinking…">Suggest a starting list</SubmitButton>
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              Everything it proposes is saved as an ordinary dish you can edit or delete.
            </p>
          </form>
        ) : null}

        {dishes.length ? (
          <ul className="card mb-3 space-y-1 text-sm">
            {dishes.map((d) => (
              <li key={d.id}>
                {d.name} <span className="text-xs text-ink-soft">· {d.effortMinutes} min</span>
              </li>
            ))}
          </ul>
        ) : null}

        <details className="card">
          <summary className="cursor-pointer text-sm font-semibold">Add one yourself</summary>
          <div className="mt-3">
            <DishForm
              key={`new-${dishes.length}`}
              defaults={{ servings: household.servings, minutes: household.weeknightMinutes }}
            />
          </div>
        </details>
      </Step>

      <form action={completeOnboardingAction} className="mt-6">
        <SubmitButton className="btn-primary w-full">
          {ready ? "Done — what's for dinner?" : 'Skip the rest for now'}
        </SubmitButton>
      </form>

      <p className="mt-3 text-center text-xs text-ink-soft">
        You can change any of this later on the{' '}
        <Link href="/family" className="font-semibold text-brand">
          Family
        </Link>{' '}
        page.
      </p>
    </main>
  );
}

function Step({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
        <span
          className={`flex size-6 items-center justify-center rounded-full text-xs ${
            done ? 'bg-leaf-soft text-leaf' : 'bg-surface-2 text-ink-soft'
          }`}
        >
          {done ? '✓' : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
