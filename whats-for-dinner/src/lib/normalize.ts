/**
 * Ingredient / item name normalisation.
 *
 * Everything the family types ("2 Chicken Breasts", "tomatoes", "Olive Oil")
 * has to line up with everything the model writes back. We normalise both
 * sides to a canonical key and match on that.
 */

const PUNCTUATION = /[.,;:!?()[\]{}"'`*_/\\]+/g;

/** Words that carry no meaning for matching a pantry item to an ingredient. */
const NOISE = new Set([
  'a', 'an', 'the', 'of', 'fresh', 'freshly', 'dried', 'ground', 'chopped',
  'sliced', 'diced', 'minced', 'grated', 'shredded', 'peeled', 'cooked',
  'raw', 'large', 'small', 'medium', 'extra', 'organic', 'ripe', 'plain',
  'whole', 'half', 'finely', 'roughly', 'optional', 'to', 'taste', 'some',
  'boneless', 'skinless', 'free', 'range',
]);

/** Irregular singulars we hit constantly in a kitchen. */
const IRREGULAR: Record<string, string> = {
  leaves: 'leaf',
  loaves: 'loaf',
  potatoes: 'potato',
  tomatoes: 'tomato',
  mangoes: 'mango',
  chilies: 'chili',
  chillies: 'chili',
  chilli: 'chili',
  berries: 'berry',
  cherries: 'cherry',
  knives: 'knife',
  halves: 'half',
};

/** Household spellings that mean the same shelf. */
const SYNONYMS: Record<string, string> = {
  aubergine: 'eggplant',
  courgette: 'zucchini',
  coriander: 'cilantro',
  capsicum: 'bell pepper',
  garbanzo: 'chickpea',
  'spring onion': 'green onion',
  scallion: 'green onion',
  'minced beef': 'ground beef',
  'mince beef': 'ground beef',
  'beef mince': 'ground beef',
  'minced lamb': 'ground lamb',
  'lamb mince': 'ground lamb',
  'chicken breasts': 'chicken breast',
  prawn: 'shrimp',
  aubergines: 'eggplant',
  yoghurt: 'yogurt',
  yohgurt: 'yogurt',
  curd: 'yogurt',
  maize: 'corn',
  'soy': 'soy sauce',
};

function singular(word: string): string {
  if (IRREGULAR[word]) return IRREGULAR[word];
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('ses') || word.endsWith('xes') || word.endsWith('zes') || word.endsWith('ches') || word.endsWith('shes')) {
    return word.slice(0, -2);
  }
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')) return word.slice(0, -1);
  return word;
}

/**
 * Canonical key for an item name. Lowercased, de-punctuated, de-pluralised,
 * with filler words dropped and household synonyms folded together.
 */
export function normalizeName(input: string): string {
  const cleaned = (input ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(PUNCTUATION, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';

  const direct = SYNONYMS[cleaned];
  if (direct) return direct;

  const words = cleaned
    .split(' ')
    .map((w) => singular(w))
    .filter((w) => w && !NOISE.has(w));

  const joined = words.join(' ');
  if (!joined) return cleaned;
  return SYNONYMS[joined] ?? joined;
}

/** Tokens of a normalised name, used for partial ("chicken" ⊂ "chicken breast") matches. */
export function nameTokens(input: string): string[] {
  const n = normalizeName(input);
  return n ? n.split(' ') : [];
}

/**
 * How well a pantry item covers an ingredient, 0..1.
 *  1    exact canonical match
 *  0.8  one name fully contains the other ("rice" covers "basmati rice")
 *  0.5  they share a distinctive head word
 *  0    unrelated
 */
export function nameSimilarity(pantryName: string, ingredientName: string): number {
  const a = normalizeName(pantryName);
  const b = normalizeName(ingredientName);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const at = a.split(' ');
  const bt = b.split(' ');
  const aSet = new Set(at);
  const bSet = new Set(bt);

  if (at.every((t) => bSet.has(t)) || bt.every((t) => aSet.has(t))) return 0.8;

  // Head word (last token) is the actual noun in English food names.
  if (at[at.length - 1] === bt[bt.length - 1]) return 0.5;
  return 0;
}

/** Title-case a name for display without mangling acronyms the user typed. */
export function displayName(input: string): string {
  const trimmed = (input ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
