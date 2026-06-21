/**
 * Seed / ingest script (ARCHITECTURE.md §3, §5, §12) — Phase 2.
 *
 * Populates reference data into Postgres:
 *   1. Venues + teams + groups (from football-data.org / OpenFootball).
 *   2. bracket_slots from src/data/bracket-2026.seed.json.
 *   3. third_place_map — the FULL 495-row Annex C table (ingest verbatim from the
 *      official FIFA table; assert row count === 495 after import — see §12.13).
 *   4. i18n_labels — Wikidata multilingual labels for the 6 locales (fetchLabels).
 *
 * Stub so `npm run seed` resolves; the ingest lands in Phase 2.
 */

async function main(): Promise<void> {
  console.log('[seed] stub — Phase 2 ingests venues/teams, bracket slots, Annex C (495 rows), and Wikidata labels.');
}

void main();

export {};
