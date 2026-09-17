import { canonicalUnit } from '@/lib/units';
import type { DishIngredient } from '@/lib/types';

/**
 * Ingredients arrive from the form as one per line:
 *   "chicken thighs | 800 | g"
 *   "500 g rice"
 *   "olive oil (optional)"
 * Both shapes are accepted because people will type both.
 */
export function parseIngredientLines(text: string): DishIngredient[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const optional = /\(optional\)/i.test(line);
      const body = line.replace(/\(optional\)/gi, '').trim();

      if (body.includes('|')) {
        const [name, qty, unit] = body.split('|').map((p) => p.trim());
        return { name, quantity: Number(qty) || 0, unit: canonicalUnit(unit), optional };
      }

      const m = body.match(/^([\d.]+)\s*([a-zA-Z]+)?\s+(.*)$/);
      if (m) return { name: m[3].trim(), quantity: Number(m[1]) || 0, unit: canonicalUnit(m[2]), optional };

      return { name: body, quantity: 0, unit: 'unit', optional };
    })
    .filter((i) => i.name);
}
