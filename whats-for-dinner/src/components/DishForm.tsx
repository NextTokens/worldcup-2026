import { saveDishAction } from '@/lib/actions/dishes';
import { formatAmount } from '@/lib/units';
import type { Dish } from '@/lib/types';
import { SubmitButton } from './SubmitButton';

function ingredientsToText(dish?: Dish): string {
  if (!dish) return '';
  return dish.ingredients
    .map((i) => `${i.name} | ${i.quantity || ''} | ${i.unit}${i.optional ? ' (optional)' : ''}`)
    .join('\n');
}

export function DishForm({ dish, defaults }: { dish?: Dish; defaults: { servings: number; minutes: number } }) {
  // Scoped so a dish form can share a page with the member forms.
  const id = dish?.id ? `dish-${dish.id}` : 'dish-new';

  return (
    <form action={saveDishAction} className="space-y-3">
      {dish?.id ? <input type="hidden" name="id" value={dish.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${id}-name`}>
            Dish
          </label>
          <input id={`${id}-name`} name="name" required defaultValue={dish?.name ?? ''} className="field" />
        </div>
        <div>
          <label className="label" htmlFor={`${id}-cuisine`}>
            Cuisine
          </label>
          <input id={`${id}-cuisine`} name="cuisine" defaultValue={dish?.cuisine ?? ''} className="field" />
        </div>
        <div>
          <label className="label" htmlFor={`${id}-minutes`}>
            Minutes
          </label>
          <input
            id={`${id}-minutes`}
            name="effortMinutes"
            type="number"
            min={5}
            max={300}
            defaultValue={dish?.effortMinutes ?? defaults.minutes}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor={`${id}-servings`}>
            Serves
          </label>
          <input
            id={`${id}-servings`}
            name="servings"
            type="number"
            min={1}
            max={20}
            defaultValue={dish?.servings ?? defaults.servings}
            className="field"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor={`${id}-ing`}>
          Ingredients — one per line
        </label>
        <textarea
          id={`${id}-ing`}
          name="ingredients"
          rows={6}
          defaultValue={ingredientsToText(dish)}
          placeholder={'chicken thighs | 800 | g\n500 g basmati rice\nyogurt (optional)'}
          className="field font-mono text-xs"
        />
        <p className="mt-1 text-xs text-ink-soft">
          Either <code>name | amount | unit</code> or plain &ldquo;500 g rice&rdquo;. These names are what get matched
          against your pantry, so keep them shopping-list plain.
        </p>
      </div>

      <div>
        <label className="label" htmlFor={`${id}-steps`}>
          Method — one step per line (optional)
        </label>
        <textarea id={`${id}-steps`} name="steps" rows={4} defaultValue={dish?.steps.join('\n') ?? ''} className="field" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${id}-tags`}>
            Tags (comma separated)
          </label>
          <input
            id={`${id}-tags`}
            name="tags"
            defaultValue={dish?.tags.join(', ') ?? ''}
            placeholder="quick, one pot, kids love it"
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor={`${id}-notes`}>
            Notes
          </label>
          <input id={`${id}-notes`} name="notes" defaultValue={dish?.notes ?? ''} className="field" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="favorite" defaultChecked={dish?.favorite ?? false} className="size-4" />
        Family favourite
      </label>

      <SubmitButton pendingLabel="Saving…">{dish?.id ? 'Save dish' : 'Add dish'}</SubmitButton>
    </form>
  );
}

export function IngredientSummary({ dish }: { dish: Dish }) {
  return (
    <p className="mt-1 truncate text-xs text-ink-soft">
      {dish.ingredients
        .slice(0, 6)
        .map((i) => [formatAmount(i.quantity, i.unit), i.name].filter(Boolean).join(' '))
        .join(', ')}
      {dish.ingredients.length > 6 ? ` +${dish.ingredients.length - 6} more` : ''}
    </p>
  );
}
