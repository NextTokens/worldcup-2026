# What's for Dinner

A small web app for one family. It answers the question that actually gets asked
every evening — **"what are we having tonight?"** — from what is already in the
kitchen, and then keeps the shopping list topped up so the answer stays easy
tomorrow.

It is not a recipe site. It assumes whoever cooks already knows how to cook. The
work it does is *deciding*: what fits tonight, what needs using up, who will eat
it, and what to buy back.

## How it works

The app keeps four things about **your** family, not families in general:

| | |
|---|---|
| **Your people** | who eats, what each person likes and dislikes, allergies, diets |
| **Your kitchen** | time on a weeknight vs a weekend, how many you cook for, cuisines, a hard "never serve" list |
| **Your pantry** | what is in the house right now, what you always keep in, what is near its use-by |
| **Your dishes** | the dinners this family actually cooks — yours to edit, not a public recipe database |

Every evening it ranks *your* dishes against *your* pantry:

- how much of the dish you already have (this dominates),
- what is about to go off,
- what you ate in the last few days,
- how long you have tonight,
- who likes and dislikes what — allergies and the avoid list are absolute,
- how the family rated it last time.

The top handful go to the model, which picks three, explains each one in a
sentence aimed at the cook, and may invent one new dish when nothing on file
fits. Choose one and it is locked in; anything you are short of goes straight
onto the shopping list. Say you cooked it and the ingredients come off the
pantry, the dish's history updates, and the family can rate it.

**Without an `OPENAI_API_KEY` the app still works.** The ranking above is all
local; the model adds the wording, the week's variety, and the ability to
propose new dishes. Every AI call falls back to the local result if it fails.

## Screens

- **Tonight** — three options, or the dinner you already chose, with the method and the "we cooked it" / rating loop.
- **Week** — fill the empty nights for the next seven days; no dish repeats inside a plan.
- **Pantry** — what you have. Paste a list in plain language and it is sorted into rows.
- **Shopping** — staples below their par level plus whatever the week's dinners are short of. Tick things off, then "Put away" to move them into the pantry.
- **Dishes** — your repertoire. Add your own, or ask for ideas that fit how you eat.
- **Family** — the people and the kitchen settings above.

## Stack

Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind v4 ·
Postgres (via `postgres.js`, no ORM) · OpenAI structured outputs · Vitest.

Postgres is the only infrastructure. The schema lives in `src/lib/schema.ts` and
is applied idempotently on first request, so there are no migration steps.

## Running it locally

```bash
npm install
cp .env.example .env.local     # DATABASE_URL is the only required value
npm run db:push                # optional: the app does this on first request
npm run dev                    # http://localhost:3000
```

The first visit walks through setup: household, people, pantry, dishes.

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev / production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest — normalisation, units, ranking, shopping, fallbacks |
| `npm run check:db` | Integration check of every query against a **scratch** database |
| `npm run db:push` | Apply the schema and exit |

> `check:db` writes and deletes data. Point it at a throwaway database.

## Deploying to Railway

1. **New Project → Deploy from GitHub repo**, and set the service's
   **Root Directory** to `whats-for-dinner` (this app lives in a subdirectory).
2. **Add a Postgres database** to the project and reference it from the service
   so `DATABASE_URL` is set. Nothing else is required to boot.
3. Set the variables you want:

   | Variable | Required | Notes |
   |---|---|---|
   | `DATABASE_URL` | yes | Provided by the Railway Postgres plugin |
   | `OPENAI_API_KEY` | no | Without it, suggestions stay local |
   | `OPENAI_MODEL` | no | Defaults to `gpt-4o-mini` |
   | `APP_PASSWORD` | **on a public URL** | One shared family passcode |
   | `SESSION_SECRET` | no | Signs the cookie; defaults to `APP_PASSWORD` |
   | `APP_TIMEZONE` | no | IANA name, decides which day "tonight" is |

4. Deploy. `railway.json` sets the build and start commands and points the
   health check at `/api/health`, which reports database and AI status.

Leaving `APP_PASSWORD` empty makes the app open to anyone with the URL; the UI
says so, but set it before you share the link.

## Privacy

Your pantry, dishes, people and plans live in your own database. When an API key
is set, the parts of that profile needed to choose a dinner are sent to OpenAI
with each suggestion. No other service is contacted — there are no integrations,
no analytics, and no accounts.
