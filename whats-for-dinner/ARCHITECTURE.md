# Architecture notes

Why the app is shaped the way it is. Read `README.md` first for what it does.

## The core decision: rank locally, narrate with the model

A pure-LLM version ("here is our pantry, what should we eat?") is worse in
exactly the ways that matter to a family:

- it drifts towards generic recipe-site food instead of what this family cooks,
- it cannot be trusted with an allergy, because a miss is a real-world harm,
- it costs a call for every page view,
- it is not reproducible, so the same evening gives different answers.

So the ranking is ordinary code (`src/lib/suggest/score.ts`), unit-tested, and
the model is handed a shortlist. Its job is to choose between good candidates,
explain the choice to the cook, and occasionally propose something new. That
split means:

- **Allergies and the household avoid list are enforced in code.** `hardBlock`
  removes those dishes before the model ever sees them, and again when a newly
  invented dish is scored.
- **Coverage is recomputed on our side.** Whatever the model claims about what
  is in the pantry, `pantryCoverage` decides what is actually missing, and that
  is what reaches the shopping list.
- **No key is a degraded mode, not a broken one.** `aiConfigured()` is false →
  every entry point returns the local ranking. Failed or malformed calls take
  the same path (`askJson` returns `null` rather than throwing).

## Matching names is the hard part

Everything hinges on "does the pantry cover this ingredient?", and the two sides
are typed by different people at different times ("2 Chicken Breasts" vs
"chicken breast"). `src/lib/normalize.ts` reduces both to a canonical key —
lowercased, de-pluralised, filler words dropped, household synonyms folded
(aubergine → eggplant) — and `nameSimilarity` grades partial matches so "rice"
covers "basmati rice".

Units get the same treatment but deliberately stop short of a real conversion
library (`src/lib/units.ts`). Where two amounts are comparable we compare them,
with a cook's 10% rounding; where they are not (`1 pack` vs `200 g`) we return
`null` and treat presence as good enough. Guessing would be worse than
admitting we do not know.

The same caution governs deduction after cooking: only clearly comparable
amounts are subtracted, so a bad unit guess can never silently empty a shelf.

## Data model

One household per deployment, but every table carries `household_id` so a
shared deployment is a routing change rather than a migration. Postgres only —
no Redis, no queues, no background workers. The schema (`src/lib/schema.ts`) is
entirely `if not exists` and is applied once per process on first use, which is
the whole migration story at this size.

Notable choices:

- `dish.ingredients` is `jsonb`. Ingredients are only ever read as a whole dish,
  and a child table would buy nothing but joins. Values are handed to
  `postgres.js` as objects via `sql.json()`; readers go through `src/lib/json.ts`
  so a badly-written row degrades to an empty list instead of a crash.
- `shopping_item` has a **partial** unique index on `(household_id, norm_name)
  where status = 'needed'`. One open line per item, but a full history of what
  was bought.
- `suggestion_cache` is keyed by date. Opening the app five times in an evening
  is one API call; "Show me other ideas" clears the row. Anything that changes
  the inputs — a pantry edit — clears it too.
- Ratings are computed with an aggregate at read time rather than denormalised;
  a family generates a handful of rows a week.

## Server Actions over an API layer

Every mutation is a Server Action taking `FormData`, called directly from a
`<form>`. The pages are server components that read through
`src/lib/repo/*`. There is no client-side data fetching, no API routes except
the health check, and no client state beyond `useFormStatus` for pending
buttons — so the app works with slow connections and half-loaded JavaScript,
which is the realistic condition of a phone in a kitchen.

`src/lib/suggest/today.ts` holds the read path deliberately *outside* the
`'use server'` modules, so it is not callable from the browser.

## Auth

A single shared passcode (`APP_PASSWORD`) and an HMAC-signed cookie. A family
app does not want accounts. The Edge middleware only checks that a plausible
cookie exists — the Edge runtime has no `node:crypto` — and the signature is
verified in Node inside each action via `requireSession()`. The cookie constant
lives in its own module (`src/lib/session-cookie.ts`) so the middleware bundle
never pulls in the Node-only code.

## What is deliberately not here

- **Integrations.** No supermarket APIs, no calendars, no imports. Every one of
  them is a partnership and an outage away.
- **Recipe search.** The dish list is the family's own. Growing it is an
  explicit act on the Dishes page, never a silent background fill.
- **Nutrition tracking.** A different product with a different tone.

## Testing

- `npm test` — unit tests over the pure modules: name normalisation, units,
  ranking and its hard blocks, the shopping builder, ingredient parsing, and the
  no-API-key fallbacks.
- `npm run check:db` — every repository function against a real Postgres.
  Written after double-encoded `jsonb` silently blanked every dish's
  ingredients: that class of bug is invisible to unit tests and to the type
  checker, and only a real database catches it.
