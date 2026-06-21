import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  date,
  timestamp,
  jsonb,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Canonical schema (ARCHITECTURE.md §3 + §12.1).
 * All times are stored in UTC; `venues.iana_tz` enables venue-local rendering.
 * Column names are snake_case (see `casing: 'snake_case'` in drizzle config + client).
 */

// ── Enums ──────────────────────────────────────────────────────────────────
export const stageEnum = pgEnum('stage', ['group', 'knockout']);
export const roundEnum = pgEnum('round', [
  'group',
  'R32',
  'R16',
  'QF',
  'SF',
  '3P',
  'F',
]);
export const matchStatusEnum = pgEnum('match_status', [
  'scheduled',
  'live',
  'paused',
  'finished',
  'postponed',
]);
export const eventTypeEnum = pgEnum('event_type', [
  'goal',
  'own_goal',
  'penalty_goal',
  'penalty_missed',
  'yellow',
  'red',
  'yellow_red',
  'substitution',
  'var',
]);
export const summaryTypeEnum = pgEnum('summary_type', [
  'live',
  'half_time',
  'full_time',
  'pre_match',
]);

// Bracket slot source descriptor (stored as jsonb on bracket_slots)
export type SlotSource =
  | { kind: 'group_winner'; group: string }
  | { kind: 'group_runnerup'; group: string }
  | { kind: 'third_place'; candidates: string[] }
  | { kind: 'match_winner'; slotId: string };

// ── Reference tables ─────────────────────────────────────────────────────────
export const teams = pgTable('teams', {
  id: text().primaryKey(), // our stable id (often the FIFA 3-letter code)
  fifaCode: text().notNull(),
  nameEn: text().notNull(),
  wikidataQid: text(),
  group: text(), // 'A'..'L'
  crestUrl: text(),
  flagUrl: text(),
  fifaRanking: integer(),
});

export const players = pgTable(
  'players',
  {
    id: text().primaryKey(),
    teamId: text()
      .notNull()
      .references(() => teams.id),
    nameEn: text().notNull(),
    position: text(),
    club: text(),
    shirtNumber: integer(),
    dob: date(),
    nationality: text(),
    wikidataQid: text(),
  },
  (t) => [index('players_team_idx').on(t.teamId)],
);

export const venues = pgTable('venues', {
  id: text().primaryKey(),
  city: text().notNull(),
  country: text().notNull(),
  nameLegal: text().notNull(),
  nameEvent: text(), // FIFA neutral event name (e.g. "New York New Jersey Stadium")
  ianaTz: text().notNull(), // e.g. "America/New_York"
  capacity: integer(),
});

// ── Matches & events ─────────────────────────────────────────────────────────
export const matches = pgTable(
  'matches',
  {
    id: text().primaryKey(), // our stable id; for knockouts, the bracket match no.
    matchNumber: integer(), // FIFA 1..104 schedule number
    stage: stageEnum().notNull(),
    round: roundEnum().notNull(),
    group: text(),
    homeTeamId: text().references(() => teams.id),
    awayTeamId: text().references(() => teams.id),
    kickoffUtc: timestamp({ withTimezone: true }).notNull(),
    venueId: text().references(() => venues.id),
    status: matchStatusEnum().notNull().default('scheduled'),
    minute: integer(),
    homeScore: integer(),
    awayScore: integer(),
    homePens: integer(),
    awayPens: integer(),
    lastEventSeq: integer().notNull().default(0),
    updatedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index('matches_kickoff_idx').on(t.kickoffUtc),
    index('matches_status_idx').on(t.status),
    index('matches_group_idx').on(t.group),
  ],
);

export const matchEvents = pgTable(
  'match_events',
  {
    id: text().primaryKey(),
    matchId: text()
      .notNull()
      .references(() => matches.id),
    providerEventId: text().notNull(), // dedupe key — NEVER dedupe by minute
    seq: integer().notNull(), // monotonic order within match
    minute: integer(),
    extra: integer(), // stoppage time (90+4 => minute 90, extra 4)
    type: eventTypeEnum().notNull(),
    teamId: text().references(() => teams.id),
    playerId: text(),
    playerName: text(),
    scoreAfterHome: integer(),
    scoreAfterAway: integer(),
    raw: jsonb(),
  },
  (t) => [
    // idempotent ingest: one row per (match, provider event id)
    index('events_match_seq_idx').on(t.matchId, t.seq),
    index('events_dedupe_idx').on(t.matchId, t.providerEventId),
  ],
);

// ── Standings (two tie-break algorithms aware — see §3) ──────────────────────
export const standings = pgTable(
  'standings',
  {
    group: text().notNull(),
    teamId: text()
      .notNull()
      .references(() => teams.id),
    played: integer().notNull().default(0),
    won: integer().notNull().default(0),
    drawn: integer().notNull().default(0),
    lost: integer().notNull().default(0),
    goalsFor: integer().notNull().default(0),
    goalsAgainst: integer().notNull().default(0),
    goalDifference: integer().notNull().default(0),
    points: integer().notNull().default(0),
    fairPlay: integer().notNull().default(0), // conduct score (cards)
    groupRank: integer(), // 1..4 within group
    thirdPlaceRank: integer(), // 1..12 cross-group ranking of thirds
    thirdPlaceQualifier: boolean().notNull().default(false), // top-8 of the 12 thirds
  },
  (t) => [primaryKey({ columns: [t.group, t.teamId] })],
);

// ── AI summaries (cache + audit). Key includes locale (§4). ──────────────────
export const aiSummaries = pgTable(
  'ai_summaries',
  {
    id: text().primaryKey(),
    matchId: text()
      .notNull()
      .references(() => matches.id),
    locale: text().notNull(),
    summaryType: summaryTypeEnum().notNull().default('live'),
    lastEventSeq: integer().notNull(), // regenerate only when this advances
    body: text().notNull(),
    keyEvents: jsonb(),
    asOfMinute: integer(),
    model: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ai_cache_idx').on(t.matchId, t.locale, t.summaryType, t.lastEventSeq),
  ],
);

// ── Localized labels (Wikidata-sourced names) ────────────────────────────────
export const i18nLabels = pgTable(
  'i18n_labels',
  {
    entityType: text().notNull(), // 'team' | 'player' | 'venue' | 'city'
    entityId: text().notNull(),
    locale: text().notNull(),
    label: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.entityType, t.entityId, t.locale] })],
);

// ── Bracket (§12.1) ──────────────────────────────────────────────────────────
export const bracketSlots = pgTable('bracket_slots', {
  slotId: text().primaryKey(), // "R32-M73", "F-M104"
  round: roundEnum().notNull(),
  position: integer().notNull(),
  matchNumber: integer(),
  feedsSlotId: text(),
  homeSource: jsonb().$type<SlotSource>(),
  awaySource: jsonb().$type<SlotSource>(),
  matchId: text().references(() => matches.id),
  homeTeamId: text().references(() => teams.id),
  awayTeamId: text().references(() => teams.id),
});

export const thirdPlaceMap = pgTable('third_place_map', {
  qualifyingCombo: text().primaryKey(), // sorted 8-letter combo, e.g. "ABCDEFGH"
  assignments: jsonb().$type<Record<string, string>>().notNull(), // { "R32-M79": "C", ... }
});

export type Team = typeof teams.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Venue = typeof venues.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchEvent = typeof matchEvents.$inferSelect;
export type Standing = typeof standings.$inferSelect;
export type BracketSlotRow = typeof bracketSlots.$inferSelect;
