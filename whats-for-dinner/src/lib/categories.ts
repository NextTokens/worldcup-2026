import { nameTokens, normalizeName } from './normalize';
import type { PantryCategory } from './types';

/**
 * Best-effort aisle for an item name.
 *
 * Used when there is no OpenAI key (and as a fallback when the model omits a
 * category), so the pantry and the shopping list still group sensibly instead
 * of collapsing into one long "other" pile.
 *
 * Matching is on whole words, never substrings — "kitchen roll" is not bakery
 * and "candles" are not canned goods. Multi-word keywords are checked first so
 * a specific phrase beats a generic word, and the list is ordered so that the
 * more distinctive aisles get first refusal.
 */
const KEYWORDS: [PantryCategory, string[]][] = [
  ['household', ['kitchen roll', 'paper towel', 'detergent', 'soap', 'bin bag', 'foil', 'cling film', 'washing up']],
  ['frozen', ['frozen', 'ice cream']],
  ['canned', ['tinned', 'canned', 'tin', 'passata', 'puree', 'stock', 'broth', 'coconut milk']],
  ['seafood', ['fish', 'salmon', 'tuna', 'shrimp', 'cod', 'sardine', 'mackerel']],
  ['meat', ['chicken', 'beef', 'lamb', 'mince', 'steak', 'sausage', 'bacon', 'turkey', 'pork', 'ham', 'thigh', 'breast']],
  ['dairy', ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg', 'labneh', 'feta', 'mozzarella', 'parmesan']],
  ['bakery', ['bread', 'pita', 'bun', 'roll', 'tortilla', 'wrap', 'baguette', 'naan']],
  ['grains', ['rice', 'pasta', 'noodle', 'flour', 'couscous', 'bulgur', 'oat', 'quinoa', 'cereal', 'lentil', 'chickpea', 'bean', 'freekeh']],
  ['spices', ['salt', 'pepper', 'cumin', 'paprika', 'cinnamon', 'turmeric', 'chili', 'spice', 'bay leaf', 'oregano', 'thyme', 'sumac', 'zaatar', 'cardamom']],
  ['condiments', ['oil', 'vinegar', 'sauce', 'ketchup', 'mayo', 'mustard', 'tahini', 'honey', 'jam', 'sugar', 'syrup', 'paste']],
  ['drinks', ['juice', 'water', 'tea', 'coffee', 'soda', 'cola']],
  ['produce', ['tomato', 'onion', 'garlic', 'potato', 'carrot', 'lettuce', 'cucumber', 'pepper', 'spinach', 'apple', 'banana', 'lemon', 'lime', 'orange', 'herb', 'parsley', 'cilantro', 'mint', 'ginger', 'zucchini', 'eggplant', 'mushroom', 'broccoli', 'cauliflower', 'cabbage', 'celery', 'avocado', 'salad', 'green onion', 'pea']],
];

export function guessCategory(name: string): PantryCategory {
  const canonical = normalizeName(name);
  if (!canonical) return 'other';

  // A multi-word keyword is specific enough to win outright.
  for (const [category, words] of KEYWORDS) {
    for (const word of words) {
      if (word.includes(' ') && canonical.includes(word)) return category;
    }
  }

  const tokens = new Set(nameTokens(name));
  for (const [category, words] of KEYWORDS) {
    if (words.some((w) => !w.includes(' ') && tokens.has(w))) return category;
  }
  return 'other';
}
