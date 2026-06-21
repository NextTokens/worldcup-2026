# World Cup 2026 App — Architecture Plan

> Mobile-first Next.js website that follows the 2026 FIFA World Cup — results, teams, rosters, players, groups, standings — with **AI-generated live match summaries** built on **public data only** (no broadcast rights, telemetry, or special access). Hosted on Railway. Multi-language and multi-timezone from day one.
>
> Status: **plan for review — no code written yet.** Tournament runs **June 11 – July 19, 2026** (104 matches). This plan is feature-driven, not deadline-driven.

---

## 0. The one decision that shapes everything

Research (verified against the live APIs on 2026-06-03) surfaced a hard tension between three of your goals:

| Goal | Reality |
|---|---|
| **Free data** | Achievable. |
| **Live mid-game AI summaries** | **Not achievable on free *sanctioned* APIs.** |
| **Commercial / monetized** | **No public API grants the right to publish WC data commercially** — FIFA holds the rights. This is a legal gate, independent of cost. |

What each free source actually gives you:

- **football-data.org** (free, official, key required) — fixtures + group standings, but **scores are DELAYED**, and **no goals/cards/subs/lineups** on the free tier. Lowest legal risk. Live needs €12/mo; events need €29/mo.
- **OpenFootball** (CC0, no key) — full 104-match **schedule + groups + venues**. Static only.
- **Wikidata / Wikipedia** (CC0 / CC BY-SA) — **squads, player bios, venues, flags, multilingual names**. Static only.
- **ESPN hidden API** (no key, free) — **VERIFIED** to return live 2026 WC scores, the `summary?event=` endpoint (goals/cards/subs, lineups, commentary), team rosters, player data, and **populated 12-group standings (A–L)**. *But it is unofficial, ToS restricts it to personal/non-commercial use, and endpoints can vanish without notice.*
- **API-Football** (free 100 req/day) — richest sanctioned live data (events refreshed ~15s), but **100 req/day can't sustain live polling**; real live needs the **~$19/mo Pro** tier.

### Recommendation — provider abstraction, start free, upgrade by flipping a flag

Build a **`MatchDataProvider` interface** so the data source is swappable per capability. Then:

- **Schedule / groups / venues** → OpenFootball (seed) + football-data.org (authoritative), both free, both sanctioned. ✅ always on.
- **Squads / players / bios / localized names / images** → Wikidata + Wikipedia, free, sanctioned. ✅ always on.
- **Live scores + in-match events (the AI-summary fuel)** → **swappable**:
  - **Path A — Free / personal launch:** ESPN provider. Free, verified, richest free live data. Accept that it's unofficial + non-commercial + best-effort.
  - **Path B — Sanctioned / commercial:** API-Football Pro (~$19/mo) provider. Flip one env var; everything downstream is identical. Add legal sign-off before monetizing.

This keeps your headline live-summary feature **and** honors "free first," while making the upgrade a config change, not a rewrite. **You decide Path A vs B per environment** (e.g. A for dev + personal preview, B when/if you go public-commercial).

> **Decisions locked (2026-06-03):** Path **A — ESPN free/unofficial** for live events · **hobby / non-commercial** project (so ESPN's personal-use terms fit; no legal gate) · **hundreds** of concurrent users (single web replica). See [§11](#11-decisions-locked). The provider abstraction stays strict so a future switch to Path B (API-Football, sanctioned) is a config change, not a rewrite.

---

## 1. Scope & feature set

Core surfaces (all mobile-first, all localized, all timezone-aware):

1. **Schedule / fixtures** — by day, by group, by team; venue-local **and** your-local kickoff times.
2. **Groups & standings** — 12 groups (A–L), live tables, "best 3rd-place" race table.
3. **Knockout bracket & path explorer** — a live-resolving, interactive Round-of-32 → Final tree (the FIFA third-place placement logic), plus a per-team "road to the final" with projected-default + interactive what-if. Full spec in [§12](#12-knockout-bracket--path-explorer-feature-spec).
4. **Teams** — roster/squad, fixtures, group, results.
5. **Players** — bio, position, club, nationality, tournament stats (where the active live provider exposes them).
6. **Match page** — the centerpiece. Pre-match (lineups when available), **live score + event timeline**, and the **AI live summary + latest-updates feed** that refreshes mid-game.
7. **AI summaries** — per-match, per-language, regenerated as new events arrive; honest "as of minute X" stamping.

Non-goals for v1 (revisit later): user accounts, **persistent prediction *games* / leaderboards** (the bracket's what-if path explorer is in scope — see §12 — but score-keeping competitions are not), push notifications (designed-for, not built), xG/advanced analytics (data-tier dependent).

---

## 2. Data layer & the provider abstraction

```
src/lib/data/
  provider.ts            # MatchDataProvider interface (the contract)
  providers/
    openfootball.ts      # static schedule/groups/venues seed (free)
    footballData.ts      # authoritative fixtures + standings (free, official)
    espn.ts              # live scores + events + standings (free, UNOFFICIAL)
    apiFootball.ts       # live scores + events + players (paid ~$19/mo, sanctioned)
    wikidata.ts          # squads, bios, multilingual names, images
  registry.ts            # picks the active provider per capability from env
  normalize.ts           # maps every provider's shape -> our canonical model
```

The interface (sketch):

```ts
interface MatchDataProvider {
  getFixtures(opts): Promise<Fixture[]>;
  getStandings(group?): Promise<GroupTable[]>;
  getSquad(teamId): Promise<Player[]>;
  getLiveMatch(matchId): Promise<LiveMatchState>;   // score + ordered events
  capabilities: { live: boolean; events: boolean; lineups: boolean; players: boolean };
}
```

**Normalization is mandatory.** Every provider returns a different shape; we map all of them to one canonical model keyed by **stable IDs we own** (e.g. our own `matchId`, FIFA team codes `USA/BRA/ARG`). This is what makes providers swappable and lets us cross-check (authoritative schedule from football-data.org, live events from ESPN/API-Football, reconciled by kickoff time + teams). **Dedupe events by the provider's `event_id`, never by minute** (stoppage-time goals collide on minute).

**Attribution** is a hard requirement of the free sources — football-data.org ("Football data provided by the Football-Data.org API") and Wikidata/Wikipedia (CC BY-SA). A footer credits block ships in v1.

---

## 3. World Cup 2026 data model (verified specifics)

Common assumptions that are **wrong** for 2026 — the model must reflect the real format:

- **48 teams, 12 groups of 4 (A–L)** — not 32/8. The `group` enum has **12** values.
- **New Round of 32** is the first knockout round. Finalists play **8** matches, not 7.
- **104 matches** (72 group + 32 knockout) over 39 days.
- **Advancement:** top 2 per group (24) **+ the 8 best 3rd-placed teams of 12** = 32 into the R32.
- **Two different tie-break algorithms** (model both):
  - *Intra-group:* H2H points → H2H GD → H2H goals → overall GD → overall goals → fair-play → FIFA ranking. (**Head-to-head first** in 2026 — changed from prior editions.)
  - *Cross-group 3rd-place ranking:* points → overall GD → overall goals → fair-play → FIFA ranking (no H2H — different opponents).
- **R32 bracket pairings come from a fixed FIFA lookup table** keyed on *which* groups the 8 qualifying thirds come from. Model this mapping explicitly — **do not hardcode a static bracket.**
- Store both **legal and FIFA-event stadium names** (e.g. SoFi/Levi's/MetLife use neutral names during the event).
- Hosts: USA (11 cities), Mexico (3), Canada (2) = **16 stadiums**. Opener **Mexico v South Africa, Estadio Azteca, June 11**; Final **July 19, MetLife Stadium**.
- All 48 slots are filled (final draw was Dec 5, 2025) — groups A–L are seedable now.

### Schema (Postgres, canonical)

```
teams        (id, fifa_code, name_en, wikidata_qid, group, flag_url, ...)
players      (id, team_id, name_en, position, club, dob, nationality, wikidata_qid, ...)
venues       (id, city, country, name_legal, name_event, iana_tz, capacity, ...)
matches      (id, stage, round, group, home_team_id, away_team_id,
              kickoff_utc, venue_id, status, home_score, away_score, ...)
match_events (id, match_id, provider_event_id, minute, extra, type,
              team_id, player_id, score_after, raw_json, seq)     -- idempotent ingest
standings    (group, team_id, played, w, d, l, gf, ga, gd, points,
              group_rank, third_place_qualifier, ...)             -- two-algorithm aware
ai_summaries (id, match_id, locale, summary_type, last_event_seq,
              body, key_events_json, as_of_minute, model, created_at)  -- cache + audit
i18n_labels  (entity_type, entity_id, locale, label)             -- Wikidata-sourced names
```

Time is **always UTC** in the DB; `venues.iana_tz` enables venue-local rendering.

---

## 4. AI live-summary engine

**Models** (latest Claude tiers):
- **`claude-haiku-4-5`** ($1/$5 per 1M) — default for frequent in-match recaps.
- **`claude-sonnet-4-6`** ($3/$15) — half-time / full-time / marquee (final) narrative only.
- `claude-opus-4-8` — offline editorial only; overkill for live. (Caches are model-scoped — keep each tier on its own cached prefix; don't alternate per event.)

**Pipeline (server-side only — clients never call providers or Anthropic directly):**

1. **Poller** (separate Railway worker) polls the live-events endpoint **every ~15s, only in the `kickoff ± 15min` window**; otherwise once/day. Window-scoping is the single biggest cost/rate-limit control. (No provider has webhooks — polling is mandatory.)
2. **Diff** new events against the last ingested `seq`. **Regenerate the summary only when new events arrive** (~10–40 LLM calls/match, not ~360 polls).
3. **Generate** — for each active locale, call Claude with:
   - a **frozen, cached system prefix** (`cache_control: ephemeral`, `ttl:'1h'`) — the grounding contract + style guide. *(Note: min cacheable prefix is 4096 tokens on Haiku — pad the contract or accept no caching; verify `usage.cache_read_input_tokens > 0`.)*
   - the **events as structured JSON** (`{event_id, minute, extra, type, team, player, score_after}`), plus **momentum we compute ourselves** (event density, score swings) passed as explicit numbers — never ask the model to infer momentum.
4. **Structured Outputs** with a Zod/JSON schema: `{ summary, key_events:[{minute, type, description, source_event_id}], score, as_of_minute }`.
5. **Validate server-side: reject any `key_event` whose `source_event_id` isn't in the input.** This, plus "summarize ONLY these events, invent nothing," is the core anti-hallucination guard. Keep `max_tokens` ~400–600. (Grounding *reduces*, not eliminates, hallucination.)
6. **Cache** the result keyed by **`(match_id, last_event_seq, summary_type, locale)`** in Redis (hot) + Postgres (durable/auditable). All viewers in a language share one generation per match state.

**Cost** (Haiku, ~30 regens/match): **~$0.09/match**, ~$0.36–0.48/day in group stage; ~6 locales multiplies the LLM line but it stays small. **The upstream data subscription ($0 on Path A, ~$19/mo on Path B) dominates total cost — not the LLM.**

**Freshness budget:** provider refresh (~15s) + our poll (15s) + generation (~1–3s) ⇒ a goal surfaces in **~15–35s**. Inherent to polled public data; the UI states "updates every ~1–2 min" and stamps "as of minute X" so it's honest.

---

## 5. Internationalization & timezones (first-class)

**i18n** — `next-intl` v4 (App-Router/RSC-native, ICU built-in, TS-checked keys):
- **Sub-path routing** `/[locale]/…` with `localePrefix: 'as-needed'` (default `en` unprefixed); `hreflang` tags per locale for SEO.
- Locale negotiation in middleware: **`NEXT_LOCALE` cookie → `Accept-Language` → default**; switcher writes the cookie.
- **ICU plurals matter** for Arabic (6 categories) and Russian — e.g. `{count, plural, one {# goal} other {# goals}}`.
- **Initial 6 locales: EN, ES, FR, PT, AR, ZH** — host-nation languages (US/MX Spanish, Canada French) + largest global football audiences, and validates **RTL (Arabic)** and **CJK (Chinese)** early.

**RTL** — CSS **logical properties** do ~90% automatically (`ms-/me-/ps-/pe-/start-/end-`, `text-start`, `border-s`); `dir` driven off locale on `<html>`; `rtl:`/`ltr:` Tailwind variants only for icon/transform exceptions. (Tailwind ≥3.3; prefer v4.)

**Localized names** — football APIs are English-only. Batch-query **Wikidata** multilingual labels once (bounded set: 48 nations, ~16 cities, ~1k players), **commit as static JSON dictionaries** keyed by our IDs (no runtime Wikidata dependency). Keep FIFA 3-letter codes for tight UI. Don't machine-translate proper nouns at runtime.

**Timezones** — store **UTC + venue IANA id**; render with **`Intl.DateTimeFormat`** (zero-dependency) in **both** venue-local and viewer-local. Detect viewer tz via `Intl.DateTimeFormat().resolvedOptions().timeZone`, allow override (cookie-persisted).
- **Critical SSR gotcha:** viewer-local time is **client-only** → render it after hydration (or gate on the persisted cookie) to avoid hydration mismatch. Server always formats with an **explicit** `timeZone` (UTC or venue), never the ambient Railway tz. Resolve DST through the IANA zone, never fixed offsets.
- `Intl` covers it today; adopt TC39 **Temporal** later behind feature-detection (Stage 4 / ES2026, native support still partial — don't ship the ~40 kB polyfill just for formatting).

---

## 6. System architecture (Next.js + Railway)

**Topology — 2 always-on services + 2 managed stores** (3rd service optional):

1. **Next.js web** (App Router) — thin reader. Renders pages from Redis/Postgres; **never polls upstream**.
2. **Poller worker** — long-lived Node loop (in-process scheduler), polls the active live provider on the windowed cadence, normalizes + diffs, writes Redis+Postgres, triggers AI regen, pings the revalidate route. **Use a worker, not Railway native cron** (5-min UTC minimum is too coarse for live).
3. *(optional later)* **realtime fan-out** service if SSE at scale.
4. **Managed Postgres** — durable history, results, AI-summary cache, i18n labels.
5. **Managed Redis** — hot live state + summary cache + optional Pub/Sub, over Railway's private network.

The worker is the **single writer** (write-through), which shields the app from provider rate limits during traffic spikes.

**Caching (Next 15 semantics):**
- `fetch` is **uncached by default** in Next 15 (good — live state stays fresh). Cache *static* data explicitly: fixtures/squads via `revalidate` + tags; wrap DB reads in `unstable_cache(fn, keys, { revalidate, tags })`.
- **Live match page:** `export const dynamic = 'force-dynamic'`, read hot state from Redis.
- **Fixtures/standings pages:** `revalidate ~300s` + **on-demand invalidation** — worker hits a protected `POST /api/revalidate?secret=…` calling `revalidateTag('match:123')` on each goal/card/sub.
- **Multi-replica ISR gotcha:** the default FS cache is per-instance, so `revalidateTag` only hits the replica that received it. **Run a single web replica for v1** (sidesteps it entirely); if scaling, add a **Redis-backed `cacheHandler`**.

**Live updates to the client (mobile-first):**
- **v1:** client polling of a **cached summary endpoint** — TanStack Query `refetchInterval` ~10–30s, **paused when the tab is hidden** (battery), revalidate on focus/reconnect, ETag so unchanged polls are cheap.
- **Upgrade:** **SSE** (`EventSource`, `Last-Event-ID` resync) for one-way score push — ~30–65% more battery/data-efficient than polling; Route Handler returning `text/event-stream` over HTTP/2. **Reconnect-and-resync on resume** (mobile OS kills sockets on lock).
- **Avoid WebSockets** (bidirectional unneeded for read-only scores). Background goal alerts → Web Push (APNs/FCM) later.

**Railway deploy:** multi-stage Dockerfile + `output:'standalone'`; **bind `HOSTNAME=0.0.0.0` + `PORT`**; a **`/health` route returning 200** for zero-downtime swaps; Postgres/Redis via reference vars (`DATABASE_URL`, `REDIS_URL`); migrations via pre-deploy command. **Do not enable app-sleeping** on web/worker (pollers/DB pools emit outbound traffic so they never truly sleep, and cold wakes can 502) — control cost with one web replica + Redis hot cache + spend alerts.

---

## 7. Mobile-first UI

- **Tailwind v4**, mobile-first (unprefixed = all sizes, `sm:/md:/lg:` enhance), logical properties for RTL.
- Component system: match card (score + clock + event ticker), group table, bracket, team/player pages, AI-summary panel with "as of minute X" + last-updates feed.
- **Optional PWA** via **Serwist** (App-Router successor to next-pwa): Network-First for live API (fall back to last-known score offline), Cache-First for assets. HTTPS is automatic on Railway; **test iOS PWA on a real device** (features only post Add-to-Home-Screen).

---

## 8. Proposed tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 (logical props for RTL) |
| i18n | next-intl v4 |
| DB / ORM | Postgres (Railway) + **Drizzle** (light, typed; Prisma is a fine alternative) |
| Cache / hot state | Redis (Railway) via ioredis |
| Client data | TanStack Query → SSE upgrade |
| AI | `@anthropic-ai/sdk`, Haiku 4.5 default / Sonnet 4.6 marquee, Structured Outputs + prompt caching |
| Validation | Zod (shared with structured outputs) |
| PWA (optional) | Serwist |
| Hosting | Railway: web + worker services, managed Postgres + Redis |

---

## 9. Phased roadmap (feature-complete, not deadline-cut)

Per your steer — features aren't sacrificed for the calendar. Phases are an *order*, not a scope cut.

- **Phase 1 — Foundations:** Next.js + Tailwind + next-intl scaffold; canonical schema + migrations; OpenFootball seed; football-data.org fixtures/standings; Wikidata squads/labels; timezone rendering. → Browse schedule, groups, teams, players in 6 languages.
- **Phase 2 — Provider abstraction + live state:** `MatchDataProvider` interface; ESPN provider (Path A) behind it; poller worker; Redis hot state; live match page with event timeline.
- **Phase 3 — AI engine:** grounded structured-output summaries, per-locale, event-diff regeneration, two-layer caching, momentum derivation, `source_event_id` validation.
- **Phase 4 — Knockout bracket & path explorer:** bracket-slot graph + static seed, the deterministic resolution engine (decided/projected/open states), best-3rd-place race table, FIFA third-place lookup table, projected-default + interactive what-if path explorer, three mobile view modes, deep-linking to/from match & team pages. (Depends on standings from Phase 1.) Full spec in §12.
- **Phase 5 — Realtime + polish:** SSE, on-demand revalidation (incl. `bracket` tag), PWA, attribution/footer, error/degraded modes.
- **Phase 6 — (decision-gated) Sanctioned/commercial:** flip live provider to API-Football Pro; legal review; optional Web Push, accounts, prediction games/leaderboards.

---

## 10. Top risks (with mitigations)

1. **Commercial licensing of WC data (highest, legal not technical).** No public API grants the right to *publish* WC data commercially; FIFA holds rights. → Ship non-commercial/ad-light, attribute every source, legal review before monetizing. **Gates the business model — decide early.**
2. **Free path can't do sanctioned live.** → Path A (ESPN, unofficial) for free/personal; Path B (API-Football $19/mo) for sanctioned. Abstraction makes it a flag.
3. **ESPN is unofficial & fragile.** → Isolate behind the provider interface; football-data.org standings as degraded fallback; cache aggressively; be polite (throttle) to avoid IP blocks.
4. **Single live-provider dependency.** → Idempotent ingest keyed by `event_id` so failover never double-posts; football-data.org as degraded mode.
5. **Provider rate limits / 429.** → Strict `kickoff ± 15min` windowing, backoff, worker as single writer.
6. **Hallucination residue.** → Structured I/O, mandatory `source_event_id` validation, terse `max_tokens`, snapshot stamping.
7. **Volunteer-data staleness (OpenFootball/Wikidata).** → Re-verify near kickoff; live provider is source-of-truth for live state.
8. **SSR timezone hydration mismatch.** → Viewer-local time renders client-side only; server formats with explicit tz.

---

## 11. Decisions locked

Settled 2026-06-03:

1. **Live-data path → A: ESPN hidden API** (free, unofficial), behind the `MatchDataProvider` interface. Keeps the full live AI-summary feature at $0. Isolated so a future flip to API-Football (Path B) is a config change.
2. **Commercial intent → hobby / non-commercial.** ESPN's personal-use terms fit; **no legal gate** for launch. If this ever changes, switch to Path B + legal review *before* monetizing.
3. **Scale → hundreds.** Single web replica + client polling + Redis hot cache. No multi-replica `cacheHandler` or managed realtime needed for v1.

**Consequences for the build:** ESPN is the live provider; treat it as best-effort (isolate, cache, throttle to avoid IP blocks, keep football-data.org standings as degraded fallback). Single web replica sidesteps the ISR multi-replica cache issue entirely. Attribution footer still required for football-data.org + Wikidata.

---

## 12. Knockout bracket & path explorer (feature spec)

> The bracket is **derived from data**, not a static image: every slot resolves through an engine as results land. On top of it sits a per-team **"Road to the Final"** that is **projected by default and overridable interactively** (the "both" mode you chose). Spec-only — no wireframes; layout is described precisely enough to build from.

### 12.0 User stories

- *As any fan,* I open a **Bracket** tab and see the full R32→Final tree, with real teams where known and labelled placeholders ("Winner Group A", "3rd A/B/F/I") where not — updated daily as matches finish.
- *As a fan of a team,* I select my team and see its **road to the final** as a visual chain, with **projected opponents** at each round and the **date/venue** of each step.
- *As a fan mid-group-stage,* I can see how finishing **1st vs 2nd vs 3rd** sends my team down different sides — *before* the group even ends.
- *As a fan,* I can **tap any match to pick a what-if winner** and watch my team's projected path and opponents re-light downstream; I can **share** that scenario by URL.
- *Everywhere,* slots **link** to the relevant match page; team/group pages **link into** the bracket focused on that team.

### 12.1 Data model

The bracket is a layer over `matches`/`standings`, plus two new tables:

```
bracket_slots (
  slot_id        TEXT PK,      -- stable id, e.g. "R32-M73", "R16-M89", "QF-M97", "F-M104"
  round          TEXT,         -- R32 | R16 | QF | SF | 3P | F
  position       INT,          -- ordering within the round (drives layout + which "half")
  feeds_slot_id  TEXT,         -- the slot this winner advances to (null for F/3P)
  -- exactly one source per side is non-null:
  home_source    JSONB,        -- {kind:'group_winner',group:'A'} | {kind:'group_runnerup',group:'F'}
                               -- | {kind:'third_place', candidates:['B','E','F','I']}
                               -- | {kind:'match_winner', slot_id:'R32-M73'}
  away_source    JSONB,
  match_id       TEXT,         -- the real fixture once scheduled (FK matches.id)
  home_team_id   TEXT,         -- resolved actual team (null until decided)
  away_team_id   TEXT
)

third_place_map (              -- FIFA's fixed lookup, seeded as static reference data
  qualifying_combo TEXT PK,    -- the 8 groups whose 3rd-placed teams advanced, normalized+sorted, e.g. "ABCDEFGH"
  assignments      JSONB       -- { "<R32 slot_id>": "<group letter>" } for each third-place slot
)
```

`standings` already carries `group_rank` + `third_place_qualifier` (from §3). The bracket engine consumes those; it does **not** duplicate standings logic.

### 12.2 Bracket graph & static seed

- The **shape** (32→16→8→4→2→1 + 3rd-place) and the **group-rank/match-winner wiring** are *fixed* and seeded once from FIFA's published bracket (the verified table in §12.13). Only the **third-place slots' actual group** and the **resolved teams** change over time.
- Seed lives in version-controlled JSON (`src/data/bracket-2026.seed.json`) → loaded into `bracket_slots` by a migration/seed script. Treated like OpenFootball schedule data: vendored, re-verified near the knockout draw.
- The graph is a binary tree by `feeds_slot_id`; `position` encodes left/right half so the UI can lay out the two sides and the final in the middle.

### 12.3 Resolution engine

A **pure, deterministic function** — same inputs ⇒ same output — so it runs identically on the server (for the canonical view) and in the browser (for instant what-if):

```ts
resolveBracket({
  seed,            // bracket_slots graph
  standings,       // current group tables w/ ranks + 3rd-place qualification
  results,         // completed knockout results (incl. ET/penalties winner)
  projection,      // ProjectionStrategy (default: FIFA-ranking heuristic)
  overrides,       // user what-if picks: { [slot_id]: winning_team_id }  (client only)
}) : ResolvedBracket   // every slot tagged with state + team(s) + confidence
```

Each slot resolves to one of three **states**:

| State | When | Render |
|---|---|---|
| **DECIDED** | group complete & rank locked, or feeding match has a final result | solid, crest, no marker |
| **PROJECTED** | group/match unfinished but engine infers a likely team (or user override) | ghosted/dashed + "projected" / "what-if" badge |
| **OPEN** | too uncertain to project and no override | placeholder label only ("Winner Group C") |

Resolution order: groups → R32 (group-source + third-place slots) → R16 → QF → SF → F/3P, walking `feeds_slot_id`. A `match_winner` slot resolves from its two children's resolved teams + the (real or projected or overridden) outcome of its `match_id`.

### 12.4 Standings-based placement — NO outcome forecasting

> **Corrected requirement (user, 2026-06-20):** the bracket is **not a predictor**. It shows the matchups implied by the **real current group standings** and lets users explore **what-if** scenarios. It must **never auto-forecast** who wins a knockout game.

- **R32 sides** resolve to the **actual current 1st/2nd/3rd** of each group (from live standings). Group rank ordering uses current points → tiebreakers; third-place slots use the best-ranked qualifying third per Annex C candidate set.
- **Knockout (R16+) sides** have **no team** until a real `result` or a user `override` decides the feeding match. There is **no FIFA-ranking / "home advances" guess** — that auto-projection was removed.
- **Team-names-first (core UX):** an unresolved knockout side never shows a bare "Winner of match X". It carries `possible[]` — the **real teams that could reach it**, gathered from the R32 leaves below — so the bracket is readable on its own (no leaving to look up who "Winner Group A" is).
- States: **DECIDED** (real result + locked rank), **PROJECTED** (matchup known from standings, outcome open), **OPEN** (no teams yet). A match has a winner **only** from `results` or `overrides`.

### 12.5 Path explorer — "Road to the Final"

The centerpiece fan feature.

- **Entry:** pick a team (from team page, group table, or a search/typeahead). The bracket switches to **path-focus mode**.
- **Projected default:** immediately renders the team's most-likely route — entry slot → … → Final — each step showing **opponent (decided or projected)**, **round**, **date**, **venue (venue-local + your-local time)**.
- **Pre-knockout tri-route:** if the team's group isn't finished, a segmented control **"If [Team] finishes 1st ▸ 2nd ▸ 3rd"** swaps between the (up to) three different routes, since rank decides the entry slot. (3rd shows an honest "must be a top-8 third to qualify" state when projection says they're on the bubble.)
- **Interactive override:** tap **any** match node to set a what-if winner. The engine re-runs **client-side** (it's the same pure function), re-lighting the downstream path and updating projected opponents instantly. A "reset to projection" clears overrides.
- **Shareable scenarios:** overrides serialize to a compact URL query (e.g. `?wi=M73:BRA,M89:ARG`) so a fan can share "my predicted run." No account needed; purely client state encoded in the link.

### 12.6 Third-place handling

- Before the 8 qualifying third groups are known: third-place slots render their **candidate set** ("3rd A/B/F/I") and, under projection, a best-guess team marked low-confidence.
- Once all groups finish and the 8 qualifiers are known: look up `third_place_map[combo]` → assign each third-place slot its group → slots become **DECIDED**.
- A dedicated **best-3rd-place race** mini-table (the 12 thirds ranked cross-group) feeds this and gets its own view: **in / out / on the bubble**, with "what your team needs."

### 12.7 Live updates, caching, revalidation

- The **existing poller** triggers a bracket re-resolve whenever a result or standings row changes; canonical `ResolvedBracket` is cached in **Redis** (cheap, deterministic) and the bracket pages carry a **`bracket` cache tag**.
- On any group/knockout result, the worker calls `revalidateTag('bracket')` (and the specific `match:<id>` tags) — same on-demand invalidation pattern as the rest of the app, single replica.
- What-if overrides never hit the server — they re-run the pure engine in the browser over the canonical resolved state.

### 12.8 Linking / navigation

- Bracket **tab** in the main nav; deep-linkable (`/[locale]/bracket`, `/[locale]/bracket/team/[teamId]`, `+ ?wi=…`).
- Each slot/match node → the **match page**; the match page shows a "in the bracket" chip linking back, focused on that tie.
- **Team page** and **group table rows** → "View road to the final" → bracket in path-focus for that team.

### 12.9 Mobile-first UX (three view modes)

Since you opted for spec-only, the modes are defined precisely:

1. **Overview** — the full tree. Horizontal scroll + pinch-zoom with a **mini-map** thumbnail; sticky round labels; snap-to-round. Two halves left/right, Final centered. Tap a node → detail sheet (teams, time, venue, link to match).
2. **Round view** — one round at a time, **swipeable** (R32 ▸ R16 ▸ …); the densest data fits a phone width; shows all ties in that round as cards.
3. **Path focus** (default once a team is selected) — a **single vertical chain** of the team's route, large touch targets, what-if toggles inline. The most mobile-native mode and the one most fans will live in.

Visual states: DECIDED (solid + crest), PROJECTED (dashed + "projected" badge), what-if (distinct accent + "what-if" badge), your-team highlight color, subtle advance animation when a result flips a slot. A persistent legend explains the states.

### 12.10 i18n / RTL / accessibility

- All round names, badges, and "if finishes 1st/2nd/3rd" copy via next-intl ICU messages; team/city names from the Wikidata label dictionaries (§5).
- **RTL (Arabic):** the whole bracket **mirrors horizontally** — "advancement" flows right-to-left. Build with logical properties + a direction-aware layout (the tree's left/right halves swap); connector lines mirror. This is the most RTL-sensitive screen in the app — test it explicitly.
- **a11y:** the bracket is also exposed as a semantic, navigable structure (not just absolutely-positioned divs) — each tie is a labelled group, keyboard-traversable, screen-reader-announced ("Round of 32, match 73, Brazil vs winner of …, projected"). Respect `prefers-reduced-motion` for the advance animations.

### 12.11 Edge cases & failure modes

- **Unbroken group ties** (fair-play / drawing of lots pending) → mark slot confidence `contested`, never fabricate an order.
- **Third on the bubble** → path explorer is explicit that a 3rd-place route is conditional on being a top-8 third.
- **ET / penalties** → winner taken from the provider's final result (ESPN `summary` exposes shootout outcome); the engine only needs "who advanced."
- **Provider disagreement** → football-data.org standings are the reconciliation source for ranks; ESPN for knockout results; conflicts logged, canonical pick documented.
- **Seed drift** → if FIFA renumbers/reschedules, re-seed from the versioned JSON; engine is unaffected (it reads the graph).
- **Engine cheapness** → resolution is O(slots) (~63 nodes) — trivial to run per request/override.

### 12.12 Testing strategy

The deterministic engine is highly testable:

- **Unit:** feed synthetic standings/results fixtures, assert each slot's state + team. Cover: all groups open, partial, fully decided; third-place lock; ET/penalty winners; user overrides; the tri-route (1st/2nd/3rd) entry logic.
- **Golden:** assert `third_place_map` against FIFA's published worked examples (several known combos) so the trickiest table is provably correct.
- **Property:** for random complete result sets, the bracket always fully resolves to a single champion with no OPEN slots.

### 12.13 Verified bracket reference data

> ✅ **Verified.** Every item below was cross-checked by 7 adversarial verifiers against multiple independent sources (NBC Sports, Sky Sports, ESPN, FOX, the official FIFA regulations PDF, and ticketing/venue listings) — all 7 claims returned *confirmed*. Notation: `W-X` = winner of Group X · `RU-X` = runner-up · `Best3rd` = a best-third-placed team assigned via Annex C · `W##`/`L##` = winner/loser of match ##. This is the source for `bracket-2026.seed.json`. **See the seed-time caveats at the end before locking it in.**

**(a) Round of 32 — matches 73–88**

| Match | Side 1 | Side 2 | Match | Side 1 | Side 2 |
|---|---|---|---|---|---|
| 73 | RU-A | RU-B | 81 | W-D | Best3rd |
| 74 | W-E | Best3rd | 82 | W-G | Best3rd |
| 75 | W-F | RU-C | 83 | RU-K | RU-L |
| 76 | W-C | RU-F | 84 | W-H | RU-J |
| 77 | W-I | Best3rd | 85 | W-B | Best3rd |
| 78 | RU-E | RU-I | 86 | W-J | RU-H |
| 79 | W-A | Best3rd | 87 | W-K | Best3rd |
| 80 | W-L | Best3rd | 88 | RU-D | RU-G |

- Group **winners facing a third-placed team (8):** A, B, D, E, G, I, K, L.
- Group **winners facing a runner-up (4):** C, F, H, J.
- *(Corrected vs a Wikipedia prose error that listed "A, C, D, E, G, I, K, L" — independently confirmed wrong.)*

**(b) Forward wiring — R16 → Final**

| R16 (89–96) | QF (97–100) | SF / Final |
|---|---|---|
| 89 = W74 v W77 | 97 = W89 v W90 | 101 = W97 v W98 |
| 90 = W73 v W75 | 98 = W93 v W94 | 102 = W99 v W100 |
| 91 = W76 v W78 | 99 = W91 v W92 | **103 (3rd) = L101 v L102** |
| 92 = W79 v W80 | 100 = W95 v W96 | **104 (Final) = W101 v W102** |
| 93 = W83 v W84 | | |
| 94 = W81 v W82 | | |
| 95 = W86 v W88 | | |
| 96 = W85 v W87 | | |

The full 32→1 tree is reconstructable from (a) + (b).

**(c) Third-place placement — Annex C**

The 4 `Best3rd` slots are assigned by FIFA's Annex C table, keyed by *which 8 of 12 groups* produced the qualifying third-placed teams. The 8 group-winner slots that receive a third map to these matches:

| Annex C column | 1A | 1B | 1D | 1E | 1G | 1I | 1K | 1L |
|---|---|---|---|---|---|---|---|---|
| R32 match | 79 | 85 | 81 | 74 | 82 | 77 | 87 | 80 |

> **Ingest, don't hand-code.** Annex C is **495 rows** (C(12,8)). Load all rows verbatim from the official FIFA regulations / Wikipedia template into `third_place_map`, keyed by the sorted 8-letter combination; **assert `count == 495` after import.** Verifiers confirmed the headers, match numbers, row count, and a spot-check row (`E F G H I J K L → 1A=3E,1B=3J,1D=3I,1E=3F,1G=3H,1I=3G,1K=3L,1L=3K`) but not all 495 contents — so byte-check the table at ingest.

**(d) Knockout dates & venues (2026)**

| Round | Dates | Anchored venues |
|---|---|---|
| R32 (73–88) | Jun 28 – Jul 3 | M73 Jun 28 SoFi (LA) · M79 Jun 30 Estadio Azteca (Mexico City) · M85 Jul 2 BC Place (Vancouver) |
| R16 (89–96) | Jul 4 – 7 | — |
| QF (97–100) | Jul 9 – 11 | — |
| SF (101–102) | Jul 14 – 15 | M101 Jul 14 AT&T Stadium (Arlington) · M102 Jul 15 Mercedes-Benz (Atlanta) |
| 3rd (103) | Jul 18 | Hard Rock Stadium (Miami) |
| **Final (104)** | **Jul 19** | **MetLife Stadium (East Rutherford NJ)** — FIFA brands it "New York New Jersey Stadium" |

**(e) Tiebreakers** — verified; full ordering is in [§3](#3-world-cup-2026-data-model-verified-specifics). Confirmed key change: **drawing of lots removed**, replaced by FIFA World Ranking as the final intra-group criterion.

**Seed-time caveats (re-check before locking `bracket-2026.seed.json`):**
- **Slots are firm; teams are not** — the four `Best3rd` identities resolve only after all 72 group matches finish (via Annex C). Seed the *logic*, bind teams at runtime.
- **Annex C contents** rest mainly on the FIFA PDF (structurally corroborated) — byte-check the full 495 rows at ingest and assert the count.
- **FIFA.com pages didn't render** during verification (JS/403); confirmation is from agreeing independent secondaries + the FIFA PDF + indexed snippets — do one final spot-check against a live FIFA.com bracket before seeding.
- **Discarded artifacts (don't let them resurface):** M85 is BC Place Vancouver (Jul 2), *not* Kansas City Jul 3.

### 12.14 Proposed file layout

```
src/
  data/bracket-2026.seed.json          # versioned static seed (shape + wiring + third_place_map)
  lib/bracket/
    engine.ts                          # resolveBracket() — pure, isomorphic
    projection.ts                      # ProjectionStrategy + FIFA-ranking default
    thirdPlace.ts                      # candidate sets + lookup-table assignment
    scenario.ts                        # encode/decode what-if overrides <-> URL
    types.ts
  app/[locale]/bracket/
    page.tsx                           # overview / round views
    team/[teamId]/page.tsx             # path-focus
  components/bracket/                   # BracketTree, RoundView, PathChain, SlotCard, MiniMap, Legend
```
