import type { MatchDataProvider } from './provider';
import { EspnCatalogProvider } from './providers/espnCatalog';

/**
 * Single data source: ESPN (free, no key) — fixtures, standings, teams, live.
 * One path, no environment-specific fallbacks.
 */
export function getCatalogProvider(): MatchDataProvider {
  return new EspnCatalogProvider();
}

export function catalogSourceName(): string {
  return getCatalogProvider().name;
}
