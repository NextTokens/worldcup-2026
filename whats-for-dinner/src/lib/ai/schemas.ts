/**
 * JSON schemas for OpenAI structured outputs.
 *
 * Strict mode requires every property to be listed in `required` and
 * `additionalProperties: false` everywhere, so optional fields are modelled
 * as nullable instead.
 */

const ingredientSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'quantity', 'unit', 'optional'],
  properties: {
    name: { type: 'string', description: 'Plain ingredient name, no quantity in the text.' },
    quantity: { type: 'number', description: 'Amount for the whole family. Use 0 when it is "to taste".' },
    unit: { type: 'string', description: 'g, kg, ml, l, cup, tbsp, tsp, unit, pack, can.' },
    optional: { type: 'boolean' },
  },
} as const;

const optionProperties = {
  candidateIndex: {
    type: ['integer', 'null'],
    description: 'Index of the dish from the provided candidate list, or null if this is a new dish.',
  },
  name: { type: 'string' },
  cuisine: { type: 'string' },
  effortMinutes: { type: 'integer' },
  reason: {
    type: 'string',
    description: 'One or two sentences addressed to the cook, referring to what they actually have and who is eating.',
  },
  isNew: { type: 'boolean', description: 'True only when this dish is not in the candidate list.' },
  ingredients: {
    type: 'array',
    description: 'Required only for a new dish; send an empty array when reusing a candidate.',
    items: ingredientSchema,
  },
  steps: {
    type: 'array',
    description: 'Short method, 3-8 steps. Empty array when reusing a candidate the family already knows.',
    items: { type: 'string' },
  },
} as const;

export const dinnerOptionsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['note', 'options'],
  properties: {
    note: {
      type: 'string',
      description: 'One short line summarising tonight, e.g. what needs using up.',
    },
    options: {
      type: 'array',
      description: 'Exactly three dinner options, best first.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['candidateIndex', 'name', 'cuisine', 'effortMinutes', 'reason', 'isNew', 'ingredients', 'steps'],
        properties: optionProperties,
      },
    },
  },
} as const;

export const weekPlanSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['note', 'days'],
  properties: {
    note: { type: 'string', description: 'One line on how the week hangs together.' },
    days: {
      type: 'array',
      description: 'One entry per requested date, in order.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['date', 'candidateIndex', 'name', 'cuisine', 'effortMinutes', 'reason', 'isNew', 'ingredients', 'steps'],
        properties: { date: { type: 'string', description: 'YYYY-MM-DD' }, ...optionProperties },
      },
    },
  },
} as const;

export const dishIdeasSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['dishes'],
  properties: {
    dishes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'cuisine', 'tags', 'effortMinutes', 'servings', 'ingredients', 'steps', 'notes'],
        properties: {
          name: { type: 'string' },
          cuisine: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          effortMinutes: { type: 'integer' },
          servings: { type: 'integer' },
          ingredients: { type: 'array', items: ingredientSchema },
          steps: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' },
        },
      },
    },
  },
} as const;

export const pantryParseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity', 'unit', 'category', 'staple'],
        properties: {
          name: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          category: {
            type: 'string',
            description: 'One of: produce, meat, seafood, dairy, bakery, grains, canned, frozen, spices, condiments, drinks, household, other.',
          },
          staple: { type: 'boolean', description: 'True for things the family always keeps in.' },
        },
      },
    },
  },
} as const;
