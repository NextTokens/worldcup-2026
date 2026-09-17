import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { Setup } from '@/components/Setup';
import { SubmitButton } from '@/components/SubmitButton';
import { requirePage } from '@/lib/auth';
import { databaseConfigured } from '@/lib/db';
import { getHousehold } from '@/lib/repo/household';
import { listDishes } from '@/lib/repo/dishes';
import { listPlanRange } from '@/lib/repo/plan';
import { clearDayAction, planWeekAction } from '@/lib/actions/plan';
import { buildShoppingListAction } from '@/lib/actions/shopping';
import { addDays, dateRange, formatDay, todayIso } from '@/lib/date';
import { formatAmount } from '@/lib/units';

export const dynamic = 'force-dynamic';

export default async function WeekPage() {
  await requirePage('/week');
  if (!databaseConfigured()) return <Setup />;

  const household = await getHousehold();
  const start = todayIso();
  const days = dateRange(start, 7);

  const [plan, dishes] = await Promise.all([
    listPlanRange(household.id, start, addDays(start, 6)),
    listDishes(household.id, true),
  ]);

  const byDate = new Map(plan.map((p) => [p.planDate, p]));
  const byId = new Map(dishes.map((d) => [d.id, d]));
  const planned = days.filter((d) => byDate.has(d)).length;

  return (
    <AppShell householdName={household.name}>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">The week ahead</h1>
      <p className="mb-4 text-sm text-ink-soft">
        {planned ? `${planned} of 7 nights decided.` : 'Nothing planned yet.'}
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        <form action={planWeekAction}>
          <input type="hidden" name="start" value={start} />
          <input type="hidden" name="days" value={7} />
          <SubmitButton pendingLabel="Planning the week…">Fill the empty nights</SubmitButton>
        </form>
        <form action={planWeekAction}>
          <input type="hidden" name="start" value={start} />
          <input type="hidden" name="days" value={7} />
          <input type="hidden" name="overwrite" value="on" />
          <SubmitButton className="btn-ghost" pendingLabel="Replanning…" confirm="Replace the whole week?">
            Replan everything
          </SubmitButton>
        </form>
        <form action={buildShoppingListAction}>
          <input type="hidden" name="start" value={start} />
          <input type="hidden" name="days" value={7} />
          <SubmitButton className="btn-ghost" pendingLabel="Building…">
            Shopping list for this plan
          </SubmitButton>
        </form>
      </div>

      <ol className="space-y-3">
        {days.map((date) => {
          const entry = byDate.get(date);
          const dish = entry?.dishId ? byId.get(entry.dishId) : undefined;

          return (
            <li key={date} className="card">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="text-sm font-bold">{formatDay(date, start)}</h2>
                {entry?.status === 'cooked' ? (
                  <span className="chip bg-leaf-soft text-leaf">cooked</span>
                ) : entry?.status === 'skipped' ? (
                  <span className="chip bg-surface-2 text-ink-soft">skipped</span>
                ) : null}
                {date === start ? (
                  <Link href="/" className="ml-auto text-xs font-semibold text-brand">
                    Open tonight →
                  </Link>
                ) : null}
              </div>

              {entry && entry.status !== 'skipped' ? (
                <>
                  <p className="mt-1 text-lg font-semibold">{entry.dishName}</p>
                  {entry.reason ? <p className="mt-1 text-sm text-ink-soft">{entry.reason}</p> : null}
                  <p className="mt-1 text-xs text-ink-soft">
                    {[
                      dish?.cuisine || null,
                      dish ? `${dish.effortMinutes} min` : null,
                      entry.missing.length
                        ? `need ${entry.missing
                            .map((m) => [formatAmount(m.quantity, m.unit), m.name].filter(Boolean).join(' '))
                            .join(', ')}`
                        : 'all in stock',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {entry.status !== 'cooked' ? (
                    <form action={clearDayAction} className="mt-2">
                      <input type="hidden" name="date" value={date} />
                      <SubmitButton className="btn-quiet">Clear this night</SubmitButton>
                    </form>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 text-sm text-ink-soft">Open.</p>
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-6 text-center text-xs text-ink-soft">
        Heavier dishes land at the weekend, and nights early in the week lean on what you already have.
      </p>
    </AppShell>
  );
}
