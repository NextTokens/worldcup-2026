/** Shared domain types. These mirror the columns in `src/lib/schema.sql`. */

export type Household = {
  id: number;
  name: string;
  servings: number;
  weeknightMinutes: number;
  weekendMinutes: number;
  cuisines: string[];
  avoid: string[];
  noRepeatDays: number;
  budget: 'low' | 'medium' | 'high';
  shoppingDay: number | null; // 0 = Sunday
  notes: string;
  onboarded: boolean;
};

export type Member = {
  id: number;
  householdId: number;
  name: string;
  isCook: boolean;
  likes: string[];
  dislikes: string[];
  allergies: string[];
  diet: string;
  notes: string;
  sortOrder: number;
};

export type PantryItem = {
  id: number;
  householdId: number;
  name: string;
  normName: string;
  category: string;
  quantity: number;
  unit: string;
  parLevel: number;
  staple: boolean;
  useBy: string | null; // YYYY-MM-DD
  note: string;
  updatedAt: string;
};

export type DishIngredient = {
  name: string;
  quantity: number;
  unit: string;
  optional: boolean;
};

export type Dish = {
  id: number;
  householdId: number;
  name: string;
  normName: string;
  cuisine: string;
  tags: string[];
  effortMinutes: number;
  servings: number;
  ingredients: DishIngredient[];
  steps: string[];
  notes: string;
  source: 'manual' | 'ai' | 'seed';
  favorite: boolean;
  active: boolean;
  timesCooked: number;
  lastCookedAt: string | null;
  avgRating: number | null;
};

export type PlanStatus = 'planned' | 'cooked' | 'skipped';

export type PlanEntry = {
  id: number;
  householdId: number;
  planDate: string; // YYYY-MM-DD
  dishId: number | null;
  dishName: string;
  status: PlanStatus;
  reason: string;
  missing: MissingIngredient[];
  cookedAt: string | null;
};

export type MissingIngredient = {
  name: string;
  quantity: number;
  unit: string;
};

export type ShoppingItem = {
  id: number;
  householdId: number;
  name: string;
  normName: string;
  category: string;
  quantity: number;
  unit: string;
  status: 'needed' | 'bought';
  reason: string;
  source: 'manual' | 'auto' | 'plan';
  createdAt: string;
};

export type Feedback = {
  id: number;
  planEntryId: number;
  memberId: number | null;
  memberName: string;
  rating: number; // 1..5
  comment: string;
  createdAt: string;
};

/** One dinner option shown on the Today screen. */
export type Suggestion = {
  dishId: number | null;
  name: string;
  cuisine: string;
  effortMinutes: number;
  /** Plain-language reason aimed at the person who has to cook tonight. */
  reason: string;
  /** Fraction of required ingredients already in the pantry, 0..1. */
  coverage: number;
  missing: MissingIngredient[];
  usesSoon: string[];
  tags: string[];
  /** Present for dishes the assistant invented rather than picked. */
  isNew?: boolean;
  ingredients?: DishIngredient[];
  steps?: string[];
};

export type SuggestionSet = {
  date: string;
  generatedBy: 'ai' | 'local';
  note: string;
  options: Suggestion[];
};

export const PANTRY_CATEGORIES = [
  'produce',
  'meat',
  'seafood',
  'dairy',
  'bakery',
  'grains',
  'canned',
  'frozen',
  'spices',
  'condiments',
  'drinks',
  'household',
  'other',
] as const;

export type PantryCategory = (typeof PANTRY_CATEGORIES)[number];
