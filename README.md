# World Cup 2026

Mobile-first, multi-language Next.js app for the 2026 FIFA World Cup — schedule, groups, standings, teams, players, an interactive knockout **bracket + "road to the final"** path explorer, and AI live match summaries — built on **free public data**. Deploys on Railway.

> Architecture & decisions: see [`ARCHITECTURE.md`](./ARCHITECTURE.md). This README covers running it.

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS v4** (logical properties for RTL)
- **next-intl v4** — 6 locales (EN/ES/FR/PT/AR/ZH), RTL for Arabic
- **Drizzle ORM** + Postgres · **Redis** (Railway managed) — for the live/poller phases
- **Anthropic SDK** (Claude Haiku 4.5 / Sonnet 4.6) — AI summaries (Phase 3)
- **Vitest** — unit tests (bracket engine)

## Data source (free, keyless)

The app runs on a **single source: ESPN's public JSON API** (unofficial, personal/non-commercial) — fixtures, live scores, in-match events, and **current group standings**, no API key. The knockout bracket structure is verified and vendored in `src/data/bracket-2026.seed.json`; squads/localized names can be enriched from Wikidata (CC0).

## Getting started

```bash
npm install
cp .env.example .env.local   # all keys optional (add ANTHROPIC_API_KEY for AI prose)
npm run dev                  # http://localhost:3000
```

No keys required — fixtures, standings, and the bracket populate from ESPN out of the box.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev / production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (bracket engine) |
| `npm run db:generate` / `db:migrate` | Drizzle migrations (needs `DATABASE_URL`) |
| `npm run seed` | Ingest reference data + Annex C + Wikidata labels (Phase 2) |
| `npm run worker` | Live poller worker (Phase 2) |

## Project structure

```
src/
  app/[locale]/        # localized routes: home, schedule, groups, teams, match, bracket
  components/          # UI (MatchCard, GroupTable, KickoffTime, bracket/*)
  i18n/                # next-intl routing, request config, navigation
  db/                  # Drizzle schema + client
  lib/
    data/              # provider abstraction + free providers + cached catalog facade
    bracket/           # pure resolve engine, projection, path, scenario codec, tests
    time.ts            # UTC storage + venue/viewer-local formatting
  data/                # bracket-2026.seed.json (verified)
messages/              # 6 locale catalogs
```

## Status

**Phases 1–3 built** (build green: typecheck, tests, `next build`):
- **P1** — scaffold, i18n (6 locales + RTL), schema, free data providers, core pages, interactive bracket + path explorer (engine unit-tested).
- **P2** — ESPN live provider, Redis/in-memory cache, live + revalidate API routes, real poller worker (`npm run worker`).
- **P3** — grounded AI summaries (Claude Haiku 4.5, structured output + `source_event_id` validation, per-locale cache, templated fallback when no key), live match page that polls every ~30s.

Add `ANTHROPIC_API_KEY` for AI prose (otherwise a templated recap shows). Live data needs the ESPN feed reachable at runtime. The DB-ingest seed (`npm run seed`) is still a stub. See `ARCHITECTURE.md` §9.

## License / use

Non-commercial / personal. Attributes all data sources (see app footer). Not affiliated with FIFA.
