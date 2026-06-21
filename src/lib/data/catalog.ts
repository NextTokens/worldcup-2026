import { cache } from 'react';
import { getCatalogProvider } from './registry';
import { computeStandings } from './normalize';
import type {
  AppMatch,
  AppGroupStanding,
  AppTeamRef,
  AppPlayer,
} from './provider';
import { GROUP_LETTERS } from './provider';

/**
 * Cached, app-facing data facade used by pages/components. `cache()` dedupes
 * calls within a single server request. Underlying fetches carry their own
 * Next revalidate windows + tags (see providers).
 */

export const getMatches = cache(async (): Promise<AppMatch[]> => {
  const matches = await getCatalogProvider().getMatches();
  return matches.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
});

export const getStandings = cache(async (): Promise<AppGroupStanding[]> => {
  const provider = getCatalogProvider();
  const direct = await provider.getStandings();
  if (direct.length > 0) return direct;
  // Fallback: compute from finished matches (e.g. OpenFootball path).
  return computeStandings(await getMatches());
});

export const getTeams = cache(async (): Promise<AppTeamRef[]> => {
  return getCatalogProvider().getTeams();
});

export const getMatchById = cache(async (id: string): Promise<AppMatch | null> => {
  const matches = await getMatches();
  return matches.find((m) => m.id === id) ?? null;
});

export const getSquad = cache(async (teamId: string): Promise<AppPlayer[]> => {
  const provider = getCatalogProvider();
  return provider.getSquad ? provider.getSquad(teamId) : [];
});

/** group letter -> teams in that group (derived from standings, else matches). */
export const getGroups = cache(async (): Promise<Record<string, AppTeamRef[]>> => {
  const standings = await getStandings();
  const out: Record<string, AppTeamRef[]> = {};
  for (const g of standings) {
    out[g.group] = g.rows.map((r) => ({
      id: r.teamId,
      name: r.teamName,
      crestUrl: r.crestUrl ?? null,
    }));
  }
  if (Object.keys(out).length > 0) return out;

  // Derive from matches if there are no standings yet.
  const matches = await getMatches();
  for (const letter of GROUP_LETTERS) {
    const teams = new Map<string, AppTeamRef>();
    for (const m of matches) {
      if (m.group !== letter) continue;
      for (const t of [m.home, m.away]) {
        const key = t?.id ?? t?.name;
        if (t && key && !teams.has(key)) teams.set(key, t);
      }
    }
    if (teams.size) out[letter] = [...teams.values()];
  }
  return out;
});
