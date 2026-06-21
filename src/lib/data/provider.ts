/**
 * Canonical app-facing data shapes + the swappable provider contract
 * (ARCHITECTURE.md §2). Every provider normalizes its source into these types,
 * keyed by stable ids we own, so the source can be flipped via env (Path A/B).
 */

export type Round = 'group' | 'R32' | 'R16' | 'QF' | 'SF' | '3P' | 'F';
export type MatchStatus = 'scheduled' | 'live' | 'paused' | 'finished' | 'postponed';

export interface AppTeamRef {
  id: string | null;
  name: string;
  fifaCode?: string | null;
  crestUrl?: string | null;
}

export interface AppVenueRef {
  id?: string | null;
  name: string;
  city?: string | null;
  ianaTz: string;
}

export interface AppMatch {
  id: string;
  matchNumber?: number | null;
  round: Round;
  group?: string | null;
  kickoffUtc: string; // ISO 8601 UTC
  status: MatchStatus;
  minute?: number | null;
  home: AppTeamRef | null;
  away: AppTeamRef | null;
  homeScore?: number | null;
  awayScore?: number | null;
  venue?: AppVenueRef | null;
}

export interface AppStandingRow {
  teamId: string | null;
  teamName: string;
  crestUrl?: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  rank?: number | null;
}

export interface AppGroupStanding {
  group: string;
  rows: AppStandingRow[];
}

export interface AppPlayer {
  id: string;
  name: string;
  position?: string | null;
  club?: string | null;
  shirtNumber?: number | null;
  dob?: string | null;
  nationality?: string | null;
}

export interface AppLiveEvent {
  eventId: string;
  minute: number | null;
  extra?: number | null;
  type: 'goal' | 'own_goal' | 'penalty_goal' | 'penalty_missed' | 'yellow' | 'red' | 'yellow_red' | 'substitution' | 'var';
  teamId?: string | null;
  player?: string | null;
  scoreAfterHome?: number | null;
  scoreAfterAway?: number | null;
}

export interface AppLiveMatch {
  matchId: string;
  status: MatchStatus;
  minute: number | null;
  homeScore: number | null;
  awayScore: number | null;
  events: AppLiveEvent[];
}

export interface ProviderCapabilities {
  fixtures: boolean;
  standings: boolean;
  squads: boolean;
  live: boolean;
  events: boolean;
  lineups: boolean;
}

export interface MatchDataProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  getMatches(): Promise<AppMatch[]>;
  getStandings(): Promise<AppGroupStanding[]>;
  getTeams(): Promise<AppTeamRef[]>;
  getSquad?(teamId: string): Promise<AppPlayer[]>;
  getLiveMatch?(matchId: string): Promise<AppLiveMatch | null>;
}

export const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;
