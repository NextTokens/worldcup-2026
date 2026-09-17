import { deletePantryItemAction, nudgePantryAction, setPantryQuantityAction } from '@/lib/actions/pantry';
import { canonicalUnit } from '@/lib/units';
import type { PantryItem } from '@/lib/types';
import { SubmitButton } from './SubmitButton';

const DAY_MS = 86_400_000;

export function PantryRow({ item, today }: { item: PantryItem; today: string }) {
  const out = item.quantity <= 0;
  const low = !out && item.parLevel > 0 && item.quantity < item.parLevel;
  const daysLeft = item.useBy
    ? Math.round((Date.parse(`${item.useBy}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS)
    : null;

  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2.5">
      {/* On a phone the name gets its own line; the controls wrap underneath. */}
      <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
        <p className={`text-sm font-semibold ${out ? 'text-ink-soft line-through' : ''}`}>{item.name}</p>
        <p className="text-xs text-ink-soft">
          {[
            item.staple ? 'staple' : null,
            item.parLevel > 0 ? `keep ${item.parLevel} ${canonicalUnit(item.unit)}` : null,
            daysLeft !== null ? (daysLeft < 0 ? 'past use-by' : `${daysLeft}d left`) : null,
            low ? 'running low' : null,
          ]
            .filter(Boolean)
            .join(' · ') || ' '}
        </p>
      </div>

      <form action={nudgePantryAction} className="flex items-center gap-1">
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="current" value={item.quantity} />
        <input type="hidden" name="delta" value={-1} />
        <SubmitButton className="btn-ghost size-8 rounded-lg p-0" title={`Use one ${item.name}`}>
          −
        </SubmitButton>
      </form>

      <form action={setPantryQuantityAction} className="flex items-center gap-1">
        <input type="hidden" name="id" value={item.id} />
        <label className="sr-only" htmlFor={`qty-${item.id}`}>
          {item.name} quantity
        </label>
        <input
          id={`qty-${item.id}`}
          name="quantity"
          type="number"
          step="0.1"
          min="0"
          defaultValue={item.quantity}
          className="field w-20 text-center"
        />
        <span className="w-10 text-xs text-ink-soft">{canonicalUnit(item.unit)}</span>
        <SubmitButton className="btn-quiet">Set</SubmitButton>
      </form>

      <form action={nudgePantryAction}>
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="current" value={item.quantity} />
        <input type="hidden" name="delta" value={1} />
        <SubmitButton className="btn-ghost size-8 rounded-lg p-0" title={`Add one ${item.name}`}>
          +
        </SubmitButton>
      </form>

      <form action={deletePantryItemAction}>
        <input type="hidden" name="id" value={item.id} />
        <SubmitButton className="btn-quiet" confirm={`Remove ${item.name} from the pantry?`}>
          ✕
        </SubmitButton>
      </form>
    </li>
  );
}
