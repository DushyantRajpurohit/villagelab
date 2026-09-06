/**
 * Shapes returned by the Supercell war endpoints, plus the view models the war
 * room renders.
 *
 * The upstream war payload spells Town Hall as `townhallLevel` (lowercase h),
 * unlike `/players`, which uses `townHallLevel`. That inconsistency is theirs;
 * it is normalised once, here, so nothing downstream has to remember it.
 */

export type WarState = 'notInWar' | 'preparation' | 'inWar' | 'warEnded';

export interface RawWarAttack {
  attackerTag: string;
  defenderTag: string;
  stars: number;
  destructionPercentage: number;
  order?: number;
}

export interface RawWarMember {
  tag: string;
  name: string;
  townhallLevel: number;
  mapPosition: number;
  opponentAttacks?: number;
  attacks?: RawWarAttack[];
  bestOpponentAttack?: RawWarAttack;
}

export interface RawWarSide {
  tag?: string;
  name?: string;
  clanLevel?: number;
  attacks?: number;
  stars: number;
  destructionPercentage: number;
  members?: RawWarMember[];
}

export interface RawWar {
  state: WarState;
  teamSize: number;
  attacksPerMember?: number;
  preparationStartTime?: string;
  startTime?: string;
  endTime?: string;
  clan: RawWarSide;
  opponent: RawWarSide;
}

export interface RawWarLogEntry {
  result: 'win' | 'lose' | 'tie' | null;
  endTime: string;
  teamSize: number;
  attacksPerMember?: number;
  clan: RawWarSide;
  opponent: RawWarSide;
}

/* ------------------------------------------------------------ view models */

/** One member of our side, with their whole war folded into a single row. */
export interface WarMemberRow {
  tag: string;
  name: string;
  townHallLevel: number;
  mapPosition: number;
  attacksUsed: number;
  attacksAllowed: number;
  /** Hits still owed. This is the number a war leader is actually chasing. */
  unused: number;
  stars: number;
  bestDestruction: number;
  /** Null when nobody has hit this base yet — meaningfully different from 0. */
  defenseStars: number | null;
  defenseDestruction: number | null;
}

export interface SideSummary {
  tag: string | null;
  name: string;
  stars: number;
  destruction: number;
  /** Descending Town Hall counts: `[[16, 12], [15, 8]]`. */
  spread: Array<[th: number, count: number]>;
}

export type Standing = 'ahead' | 'behind' | 'level';

export interface WarAnalysis {
  state: WarState;
  teamSize: number;
  attacksPerMember: number;
  startTime: string | null;
  endTime: string | null;
  us: SideSummary;
  them: SideSummary;
  standing: Standing;
  maxStars: number;
  attacksUsed: number;
  attacksTotal: number;
  /** Ordered by map position — the order the war map itself is read in. */
  rows: WarMemberRow[];
  /** Members with hits outstanding, worst offenders first. */
  missing: WarMemberRow[];
  outstanding: number;
}

export interface WarLogEntry {
  result: 'win' | 'lose' | 'tie';
  endTime: string;
  teamSize: number;
  opponentTag: string | null;
  opponentName: string;
  stars: number;
  opponentStars: number;
  destruction: number;
  opponentDestruction: number;
}

export interface WarLogSummary {
  wars: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
  avgStars: number;
  avgDestruction: number;
  /** Longest run of wins anywhere in the window, newest-first input. */
  bestStreak: number;
}
