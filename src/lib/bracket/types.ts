export type BracketRound = 'R32' | 'R16' | 'QF' | 'SF' | '3P' | 'F';

export type SlotSource =
  | { kind: 'group_winner'; group: string }
  | { kind: 'group_runnerup'; group: string }
  | { kind: 'third_place'; candidates: string[] }
  | { kind: 'match_winner'; slotId: string }
  | { kind: 'match_loser'; slotId: string };

export interface SeedVenue {
  name: string;
  city?: string;
  ianaTz: string;
}

export interface SeedSlot {
  slotId: string;
  round: BracketRound;
  matchNumber: number;
  date?: string;
  venue?: SeedVenue;
  home: SlotSource;
  away: SlotSource;
}

export interface BracketSeed {
  thirdPlaceColumnMap: Record<string, string>;
  slots: SeedSlot[];
}

export type SlotState = 'decided' | 'projected' | 'open';
export type Confidence = 'clinched' | 'likely' | 'contested' | 'unknown';

export interface TeamLite {
  id: string;
  name: string;
  crestUrl?: string | null;
}

export interface RankedTeam {
  team: TeamLite;
  rank: number; // 1..4 within group
  clinched: boolean;
}

export interface StandingsInput {
  /** group letter -> current ranking (rank 1..4) + whether the group is final. */
  groups: Record<string, { final: boolean; ranked: RankedTeam[] }>;
  /** the 12 third-placed teams ranked best->worst (cross-group). */
  thirdPlaceOrder: { group: string; team: TeamLite; clinched: boolean }[];
  /** true once all 72 group matches are done (lets third-place slots lock). */
  allGroupsFinal: boolean;
}

export interface ResolveInput {
  seed: BracketSeed;
  standings: StandingsInput;
  /** actual knockout results: slotId -> winning side. */
  results?: Record<string, 'home' | 'away'>;
  /** user what-if picks: slotId -> winning side (client-only). */
  overrides?: Record<string, 'home' | 'away'>;
  /** lower = stronger; used to project match winners (e.g. FIFA ranking). */
  rankOf?: (teamId: string) => number | undefined;
  /** full Annex C table (combo -> {slotId: group}); enables exact 3rd assignment. */
  thirdPlaceMap?: Record<string, Record<string, string>>;
}

export interface ResolvedSide {
  source: SlotSource;
  team: TeamLite | null;
  /** When `team` is null: the real teams that could occupy this side, derived
   *  from current group standings (no outcome forecasting). Lets the bracket show
   *  actual names instead of "Winner of match X". */
  possible: TeamLite[];
  state: SlotState;
  confidence: Confidence;
  /** human-ish placeholder, e.g. "1A", "2F", "3rd C/E/F/H/I", "W74". */
  label: string;
}

export interface ResolvedSlot {
  slotId: string;
  round: BracketRound;
  matchNumber: number;
  date?: string;
  venue?: SeedVenue;
  home: ResolvedSide;
  away: ResolvedSide;
  winner: TeamLite | null;
  loser: TeamLite | null;
  state: SlotState;
  overridden: boolean;
}

export interface ResolvedBracket {
  slots: Record<string, ResolvedSlot>;
  /** R32 slot ids in top->bottom display order. */
  order: string[];
  champion: TeamLite | null;
}
