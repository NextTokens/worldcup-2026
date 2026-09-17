import { chooseDinnerAction } from '@/lib/actions/plan';
import { formatAmount } from '@/lib/units';
import type { Suggestion } from '@/lib/types';
import { SubmitButton } from './SubmitButton';

function CoverageBadge({ suggestion }: { suggestion: Suggestion }) {
  if (!suggestion.missing.length) {
    return <span className="chip bg-leaf-soft text-leaf">✓ You have everything</span>;
  }
  const label = suggestion.missing.length === 1 ? '1 item to buy' : `${suggestion.missing.length} items to buy`;
  return <span className="chip bg-warn-soft text-warn">🛒 {label}</span>;
}

export function SuggestionCard({
  suggestion,
  date,
  rank,
}: {
  suggestion: Suggestion;
  date: string;
  rank: number;
}) {
  const primary = rank === 0;

  return (
    <article className={`card ${primary ? 'border-brand/40 ring-1 ring-brand/20' : ''}`}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold leading-tight sm:text-lg">{suggestion.name}</h3>
          <p className="mt-0.5 text-xs text-ink-soft">
            {[suggestion.cuisine, `${suggestion.effortMinutes} min`, suggestion.isNew ? 'new idea' : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <CoverageBadge suggestion={suggestion} />
      </div>

      {suggestion.reason ? <p className="mt-3 text-sm leading-relaxed">{suggestion.reason}</p> : null}

      {suggestion.usesSoon.length ? (
        <p className="mt-2 text-xs text-leaf">Uses up: {suggestion.usesSoon.join(', ')}</p>
      ) : null}

      {suggestion.missing.length ? (
        <p className="mt-2 text-xs text-ink-soft">
          Still need:{' '}
          {suggestion.missing
            .map((m) => [formatAmount(m.quantity, m.unit), m.name].filter(Boolean).join(' '))
            .join(', ')}
        </p>
      ) : null}

      {suggestion.isNew && suggestion.ingredients?.length ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-ink-soft">How to make it</summary>
          <ul className="mt-2 list-inside list-disc text-xs text-ink-soft">
            {suggestion.ingredients.map((i) => (
              <li key={i.name}>
                {[formatAmount(i.quantity, i.unit), i.name].filter(Boolean).join(' ')}
                {i.optional ? ' (optional)' : ''}
              </li>
            ))}
          </ul>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-xs">
            {(suggestion.steps ?? []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </details>
      ) : null}

      <form action={chooseDinnerAction} className="mt-4">
        <input type="hidden" name="date" value={date} />
        {/* The whole suggestion travels with the form: an invented dish has no row yet. */}
        <input type="hidden" name="suggestion" value={JSON.stringify(suggestion)} />
        <SubmitButton className={primary ? 'btn-primary w-full' : 'btn-ghost w-full'} pendingLabel="Saving…">
          {primary ? "That's dinner" : 'Choose this'}
        </SubmitButton>
      </form>
    </article>
  );
}
