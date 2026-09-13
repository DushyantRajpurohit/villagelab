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

/* ------------------------------------------------------ Clan War Leagues */

/**
 * A league group's own lifecycle. Note `ended`, where a war says `warEnded` —
 * the two endpoints do not share a vocabulary either.
 */
export type LeagueState = 'notInWar' | 'preparation' | 'inWar' | 'ended';

export interface RawLeagueMember {
  tag: string;
  name: string;
  /**
   * The group roster spells it `townHallLevel`, like `/players`; the wars it
   * schedules spell it `townhallLevel`. Both are accepted so neither endpoint's
   * spelling can zero a roster.
   */
  townHallLevel?: number;
  townhallLevel?: number;
}

export interface RawLeagueClan {
  tag: string;
  name: string;
  clanLevel?: number;
  members?: RawLeagueMember[];
}

/** `#0` is a war not scheduled yet — the placeholder, not a tag. */
export interface RawLeagueRound {
  warTags: string[];
}

export interface RawLeagueGroup {
  state: LeagueState;
  /** `2026-09`. Sorts correctly as a string. */
  season: string;
  clans: RawLeagueClan[];
  rounds: RawLeagueRound[];
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

/* ------------------------------------------------- league view models */

/** One side of a league war, kept whole so any clan in the group can read it. */
export interface LeagueSide {
  tag: string;
  name: string;
  stars: number;
  /** Average destruction across the side's bases, as the war itself reports it. */
  destruction: number;
  rows: WarMemberRow[];
}

/**
 * A league war as stored. The API lists the two clans in no particular order,
 * so neither side is "us" until a clan is asked about — see `orient`.
 */
export interface LeagueWarRecord {
  warTag: string;
  /** 1-based, in the order the group schedules them. */
  round: number;
  state: WarState;
  teamSize: number;
  startTime: string | null;
  endTime: string | null;
  sides: [LeagueSide, LeagueSide];
}

export interface LeagueStanding {
  rank: number;
  tag: string;
  name: string;
  /** Including win bonuses — the figure the group is ranked on. */
  stars: number;
  bonus: number;
  /** Summed per base, not averaged: the tiebreak the game ranks on. */
  destruction: number;
  wins: number;
  losses: number;
  ties: number;
}

/**
 * `unscheduled` has no war tag yet; `pending` has one we have not fetched; `bye`
 * is a round whose wars we hold and none of which is this clan's — a group of
 * fewer than eight leaves someone out each round.
 */
export type RoundStatus = 'unscheduled' | 'pending' | 'preparation' | 'inWar' | 'warEnded' | 'bye';

export interface LeagueRound {
  round: number;
  status: RoundStatus;
  opponent: { tag: string; name: string } | null;
  stars: number;
  opponentStars: number;
  destruction: number;
  opponentDestruction: number;
  /** Only a finished war has one. */
  result: 'win' | 'lose' | 'tie' | null;
  /** Where a war still being fought stands. Null before battle day. */
  standing: Standing | null;
  startTime: string | null;
  endTime: string | null;
}

/** One member's league so far, folded across every war they were lined up for. */
export interface LeagueMemberSeason {
  tag: string;
  name: string;
  townHallLevel: number;
  /** Wars they were in the lineup for, once battle day had started. */
  wars: number;
  attacksUsed: number;
  /** Attacks not used in a war that has finished. Gone for good. */
  missed: number;
  /** Attacks not used yet in a war still being fought. */
  owed: number;
  /** New stars only — the count league medals are paid on. */
  stars: number;
  totalDestruction: number;
  avgDestruction: number;
  /** Wars in which their base was attacked at all. */
  defended: number;
  /** Best stars taken off their base, summed across those wars. */
  starsConceded: number;
}

export interface LeagueAnalysis {
  season: string;
  state: LeagueState;
  clanTag: string;
  clanName: string;
  groupSize: number;
  roundsTotal: number;
  roundsPlayed: number;
  standings: LeagueStanding[];
  us: LeagueStanding | null;
  rounds: LeagueRound[];
  members: LeagueMemberSeason[];
  /** The round being fought right now, and who in it has not attacked. */
  live: { round: number; opponent: string; endTime: string | null; owing: WarMemberRow[] } | null;
  attacksUsed: number;
  attacksMissed: number;
  attacksOwed: number;
}
