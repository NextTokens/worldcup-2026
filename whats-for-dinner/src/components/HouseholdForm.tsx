import { saveHouseholdAction } from '@/lib/actions/family';
import type { Household } from '@/lib/types';
import { SubmitButton } from './SubmitButton';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function HouseholdForm({ household }: { household: Household }) {
  return (
    <form action={saveHouseholdAction} className="card space-y-4">
      <h2 className="section-title">How your kitchen works</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="h-name">
            Household name
          </label>
          <input id="h-name" name="name" defaultValue={household.name} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="h-servings">
            Cooking for (people)
          </label>
          <input
            id="h-servings"
            name="servings"
            type="number"
            min={1}
            max={20}
            defaultValue={household.servings}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="h-weeknight">
            Weeknight time (min)
          </label>
          <input
            id="h-weeknight"
            name="weeknightMinutes"
            type="number"
            min={5}
            max={240}
            defaultValue={household.weeknightMinutes}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="h-weekend">
            Weekend time (min)
          </label>
          <input
            id="h-weekend"
            name="weekendMinutes"
            type="number"
            min={5}
            max={300}
            defaultValue={household.weekendMinutes}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="h-repeat">
            Don&rsquo;t repeat within (days)
          </label>
          <input
            id="h-repeat"
            name="noRepeatDays"
            type="number"
            min={0}
            max={60}
            defaultValue={household.noRepeatDays}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="h-budget">
            Budget
          </label>
          <select id="h-budget" name="budget" defaultValue={household.budget} className="field">
            <option value="low">Keep it cheap</option>
            <option value="medium">Normal</option>
            <option value="high">Not a concern</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="h-shopday">
            Main shopping day
          </label>
          <select
            id="h-shopday"
            name="shoppingDay"
            defaultValue={household.shoppingDay === null ? '' : String(household.shoppingDay)}
            className="field"
          >
            <option value="">No fixed day</option>
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="h-cuisines">
          Cuisines you cook (comma separated)
        </label>
        <input
          id="h-cuisines"
          name="cuisines"
          defaultValue={household.cuisines.join(', ')}
          placeholder="Levantine, Italian, quick Asian"
          className="field"
        />
      </div>

      <div>
        <label className="label" htmlFor="h-avoid">
          Never serve (comma separated)
        </label>
        <input
          id="h-avoid"
          name="avoid"
          defaultValue={household.avoid.join(', ')}
          placeholder="pork, shellfish"
          className="field"
        />
        <p className="mt-1 text-xs text-ink-soft">
          Treated as absolute — a dish containing any of these is never suggested.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="h-notes">
          Anything else the app should know
        </label>
        <textarea
          id="h-notes"
          name="notes"
          rows={3}
          defaultValue={household.notes}
          placeholder="Fridays are usually takeaway. Kids eat earlier than the adults."
          className="field"
        />
      </div>

      <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
    </form>
  );
}
