import { formatAmount } from '@/lib/units';
import type { Dish, Household, Member, PantryItem, PlanEntry } from '@/lib/types';
import type { ScoredDish } from '@/lib/suggest/score';

/** Prompt fragments. Kept separate so they are easy to read and to tune. */

export const DINNER_SYSTEM = [
  "You are the dinner assistant for one specific family. You are not a general recipe site.",
  'The cook is experienced and does not need hand-holding; what they need is a decision.',
  '',
  'Rules:',
  '1. Prefer dishes from the family\'s own list of dishes ("candidates"). Reuse them by index.',
  '2. Only invent a new dish when the candidates genuinely do not fit, and then it must be cookable',
  '   almost entirely from what is in the pantry — at most two items they would have to buy.',
  '3. Never suggest anything containing an allergen or an item on the avoid list. This is absolute.',
  '4. Respect tonight\'s time budget. A long dish on a school night is a bad answer.',
  '5. Prioritise ingredients that are about to go off.',
  '6. Do not repeat what was eaten in the last few days.',
  '7. The reason you give must be concrete and about this family — mention the actual ingredient,',
  '   the person who likes it, or the time it takes. Never write generic filler.',
  '8. Keep amounts scaled to the household serving count.',
].join('\n');

export function profileBrief(household: Household, members: Member[]): string {
  const lines: string[] = [
    `Household: ${household.name}, cooking for ${household.servings}.`,
    `Time budget: about ${household.weeknightMinutes} min on weeknights, ${household.weekendMinutes} min at weekends.`,
    `Budget level: ${household.budget}. Do not repeat a dish within ${household.noRepeatDays} days.`,
  ];
  if (household.cuisines.length) lines.push(`Cuisines they cook: ${household.cuisines.join(', ')}.`);
  if (household.avoid.length) lines.push(`NEVER serve (household avoid list): ${household.avoid.join(', ')}.`);
  if (household.notes.trim()) lines.push(`Notes: ${household.notes.trim()}`);

  if (members.length) {
    lines.push('', 'Who eats:');
    for (const m of members) {
      const bits: string[] = [];
      if (m.diet) bits.push(`diet: ${m.diet}`);
      if (m.allergies.length) bits.push(`ALLERGIC TO: ${m.allergies.join(', ')}`);
      if (m.likes.length) bits.push(`likes ${m.likes.join(', ')}`);
      if (m.dislikes.length) bits.push(`dislikes ${m.dislikes.join(', ')}`);
      if (m.notes) bits.push(m.notes);
      lines.push(`- ${m.name}${m.isCook ? ' (does the cooking)' : ''}: ${bits.join('; ') || 'no strong preferences'}`);
    }
  }
  return lines.join('\n');
}

export function pantryBrief(pantry: PantryItem[], today: string): string {
  if (!pantry.length) return 'Pantry: empty — nothing has been entered yet.';
  const inStock = pantry.filter((p) => p.quantity > 0);
  const out = pantry.filter((p) => p.quantity <= 0 && p.staple);

  const soon = inStock.filter((p) => {
    if (!p.useBy) return false;
    const days = (Date.parse(`${p.useBy}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
    return days <= 3;
  });

  const byCategory = new Map<string, string[]>();
  for (const p of inStock) {
    const line = `${p.name}${formatAmount(p.quantity, p.unit) ? ` (${formatAmount(p.quantity, p.unit)})` : ''}`;
    byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), line]);
  }

  const lines = ['In the pantry right now:'];
  for (const [cat, items] of [...byCategory.entries()].sort()) {
    lines.push(`- ${cat}: ${items.join(', ')}`);
  }
  if (soon.length) lines.push(`Use up soon (at or near use-by): ${soon.map((p) => p.name).join(', ')}.`);
  if (out.length) lines.push(`Staples they are OUT of: ${out.map((p) => p.name).join(', ')}.`);
  return lines.join('\n');
}

export function candidateBrief(candidates: ScoredDish[]): string {
  if (!candidates.length) return 'Candidate dishes: none on file yet — you will have to propose new dishes.';
  const lines = ['Candidate dishes from the family\'s own list (use candidateIndex to pick one):'];
  candidates.forEach((c, i) => {
    const missing = c.missing.length ? `missing ${c.missing.map((m) => m.name).join(', ')}` : 'have everything';
    const last = c.dish.lastCookedAt ? `last cooked ${c.dish.lastCookedAt}` : 'never cooked';
    const soon = c.usesSoon.length ? `; uses up ${c.usesSoon.join(', ')}` : '';
    lines.push(
      `[${i}] ${c.dish.name} — ${c.dish.cuisine || 'no cuisine'}, ${c.dish.effortMinutes} min, ` +
        `${Math.round(c.coverage * 100)}% in stock, ${missing}; ${last}${soon}`,
    );
  });
  return lines.join('\n');
}

export function historyBrief(history: PlanEntry[]): string {
  if (!history.length) return 'Recent dinners: none recorded.';
  return `Recent dinners (most recent first): ${history
    .slice(0, 10)
    .map((h) => `${h.planDate} ${h.dishName}${h.status === 'skipped' ? ' (skipped)' : ''}`)
    .join('; ')}.`;
}

export function dishListBrief(dishes: Dish[]): string {
  if (!dishes.length) return 'The family has no dishes on file yet.';
  return `Dishes already on file (do not repeat these): ${dishes.map((d) => d.name).join(', ')}.`;
}

export function weekdayName(dateIso: string): string {
  return new Date(`${dateIso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
}
