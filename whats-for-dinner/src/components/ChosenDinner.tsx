import { clearDayAction, markCookedAction, rateDinnerAction, skipDinnerAction } from '@/lib/actions/plan';
import { formatAmount } from '@/lib/units';
import type { Dish, Feedback, Member, PlanEntry } from '@/lib/types';
import { SubmitButton } from './SubmitButton';

/** The locked-in dinner for a day, with the "we cooked it" / rating loop. */
export function ChosenDinner({
  entry,
  dish,
  members,
  feedback,
}: {
  entry: PlanEntry;
  dish: Dish | null;
  members: Member[];
  feedback: Feedback[];
}) {
  const cooked = entry.status === 'cooked';

  return (
    <section className="card border-brand/40 ring-1 ring-brand/20">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand">
        {cooked ? 'Cooked' : "Tonight you're making"}
      </p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight">{entry.dishName}</h2>

      {entry.reason ? <p className="mt-2 text-sm leading-relaxed text-ink-soft">{entry.reason}</p> : null}

      {entry.missing.length ? (
        <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">
          Pick up on the way home:{' '}
          {entry.missing.map((m) => [formatAmount(m.quantity, m.unit), m.name].filter(Boolean).join(' ')).join(', ')}
          <span className="block opacity-80">(already added to your shopping list)</span>
        </p>
      ) : null}

      {dish?.ingredients.length ? (
        <details className="mt-4" open={!cooked}>
          <summary className="cursor-pointer text-sm font-semibold">What you need</summary>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {dish.ingredients.map((i) => (
              <li key={i.name} className="text-ink-soft">
                <span className="text-ink">{[formatAmount(i.quantity, i.unit), i.name].filter(Boolean).join(' ')}</span>
                {i.optional ? ' · optional' : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {dish?.steps.length ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold">Method</summary>
          <ol className="mt-2 list-inside list-decimal space-y-1.5 text-sm">
            {dish.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </details>
      ) : null}

      {!cooked ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={markCookedAction}>
            <input type="hidden" name="date" value={entry.planDate} />
            <SubmitButton pendingLabel="Updating…">We cooked it</SubmitButton>
          </form>
          <form action={skipDinnerAction}>
            <input type="hidden" name="date" value={entry.planDate} />
            <SubmitButton className="btn-ghost">Not tonight</SubmitButton>
          </form>
          <form action={clearDayAction}>
            <input type="hidden" name="date" value={entry.planDate} />
            <SubmitButton className="btn-quiet">Change my mind</SubmitButton>
          </form>
        </div>
      ) : null}

      {cooked ? (
        <div className="mt-4 border-t border-line pt-4">
          <p className="label">How did it go?</p>
          <form action={rateDinnerAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="date" value={entry.planDate} />
            <div>
              <label className="label" htmlFor="rate-member">
                Who
              </label>
              <select id="rate-member" name="memberId" className="field w-36">
                <option value="">Everyone</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="rate-score">
                Rating
              </label>
              <select id="rate-score" name="rating" defaultValue="4" className="field w-28">
                <option value="5">Loved it</option>
                <option value="4">Good</option>
                <option value="3">Fine</option>
                <option value="2">Meh</option>
                <option value="1">No thanks</option>
              </select>
            </div>
            <div className="min-w-40 flex-1">
              <label className="label" htmlFor="rate-comment">
                Note (optional)
              </label>
              <input id="rate-comment" name="comment" className="field" placeholder="Too spicy for the kids" />
            </div>
            <SubmitButton className="btn-ghost">Save</SubmitButton>
          </form>

          {feedback.length ? (
            <ul className="mt-3 space-y-1 text-xs text-ink-soft">
              {feedback.map((f) => (
                <li key={f.id}>
                  <span className="font-semibold text-ink">{f.memberName}</span> rated it {f.rating}/5
                  {f.comment ? ` — ${f.comment}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
