import type { MatchDataProvider } from './provider';
import { FootballDataProvider } from './providers/footballData';
import { OpenFootballProvider } from './providers/openfootball';

/**
 * Provider selection (ARCHITECTURE.md §2). The catalog source is football-data.org
 * when an API key is present (real UTC fixtures + standings), otherwise the free
 * OpenFootball static schedule so the app still renders the real structure.
 *
 * The LIVE provider (ESPN, Path A) is wired in Phase 2; selected via LIVE_PROVIDER.
 */
export function getCatalogProvider(): MatchDataProvider {
  if (process.env.FOOTBALL_DATA_API_KEY) {
    return new FootballDataProvider();
  }
  return new OpenFootballProvider();
}

export function catalogSourceName(): string {
  return getCatalogProvider().name;
}
