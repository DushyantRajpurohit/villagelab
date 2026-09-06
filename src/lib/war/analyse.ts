import type {
  RawWar, RawWarLogEntry, RawWarMember, RawWarSide, SideSummary, Standing,
  WarAnalysis, WarLogEntry, WarLogSummary, WarMemberRow,
} from './types';

/**
 * Pure war analysis. No React, no database, no network — the war room and the
 * ingestion worker both fold raw API payloads through here, so the numbers a
 * leader reads and the numbers we persist can never disagree.
 */

/** Clan War Leagues run one attack per member; regular wars run two. */
const attacksPerMemberOf = (w: { attacksPerMember?: number }) => w.attacksPerMember ?? 2;

/**
 * Credit each attacker with the stars they *added*, not the stars they scored.
 *
 * A second attack on a base the clan already three-starred is worth nothing to
 * the war, and summing raw attack stars (the obvious implementation) inflates
 * every cleanup hitter while making the member totals exceed the clan total.
 * Replaying attacks in war order against a running best-per-defender is what
 * the game itself does, and it makes `sum(rows.stars) === side.stars` hold.
 */
function starsGained(members: RawWarMember[]): Map<string, number> {
  const attacks = members
    .flatMap((m) => m.attacks ?? [])
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const bestOnBase = new Map<string, number>();
  const gained = new Map<string, number>();

  for (const a of attacks) {
    const prior = bestOnBase.get(a.defenderTag) ?? 0;
    if (a.stars > prior) {
      bestOnBase.set(a.defenderTag, a.stars);
      gained.set(a.attackerTag, (gained.get(a.attackerTag) ?? 0) + (a.stars - prior));
    } else {
      gained.set(a.attackerTag, gained.get(a.attackerTag) ?? 0);
    }
  }
  return gained;
}

export function memberRows(side: RawWarSide, attacksAllowed: number): WarMemberRow[] {
  const members = side.members ?? [];
  const gained = starsGained(members);

  return members
    .map((m): WarMemberRow => {
      const attacks = m.attacks ?? [];
      return {
        tag: m.tag,
        name: m.name,
        townHallLevel: m.townhallLevel,
        mapPosition: m.mapPosition,
        attacksUsed: attacks.length,
        attacksAllowed,
        unused: Math.max(0, attacksAllowed - attacks.length),
        stars: gained.get(m.tag) ?? 0,
        bestDestruction: attacks.reduce((a, x) => Math.max(a, x.destructionPercentage), 0),
        // Null, not zero: "nobody has attacked this base" is not "held to zero".
        defenseStars: m.bestOpponentAttack ? m.bestOpponentAttack.stars : null,
        defenseDestruction: m.bestOpponentAttack ? m.bestOpponentAttack.destructionPercentage : null,
      };
    })
    .sort((a, b) => a.mapPosition - b.mapPosition);
}

/** Descending Town Hall counts — the fastest read on whether a matchup is fair. */
export function spreadOf(side: RawWarSide): Array<[number, number]> {
  const counts = new Map<number, number>();
  for (const m of side.members ?? []) {
    counts.set(m.townhallLevel, (counts.get(m.townhallLevel) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[0] - a[0]);
}

/** War is decided on stars, then destruction — same order the game uses. */
export function standingOf(us: RawWarSide, them: RawWarSide): Standing {
  if (us.stars !== them.stars) return us.stars > them.stars ? 'ahead' : 'behind';
  if (us.destructionPercentage === them.destructionPercentage) return 'level';
  return us.destructionPercentage > them.destructionPercentage ? 'ahead' : 'behind';
}

const summarise = (side: RawWarSide, fallbackName: string): SideSummary => ({
  tag: side.tag ?? null,
  name: side.name ?? fallbackName,
  stars: side.stars ?? 0,
  destruction: side.destructionPercentage ?? 0,
  spread: spreadOf(side),
});

export function analyseWar(war: RawWar): WarAnalysis {
  const attacksAllowed = attacksPerMemberOf(war);
  const rows = memberRows(war.clan, attacksAllowed);
  const missing = rows
    .filter((r) => r.unused > 0)
    .sort((a, b) => b.unused - a.unused || a.mapPosition - b.mapPosition);

  return {
    state: war.state,
    teamSize: war.teamSize,
    attacksPerMember: attacksAllowed,
    startTime: war.startTime ?? null,
    endTime: war.endTime ?? null,
    us: summarise(war.clan, 'Our clan'),
    them: summarise(war.opponent, 'Opponent'),
    standing: standingOf(war.clan, war.opponent),
    maxStars: war.teamSize * 3,
    attacksUsed: rows.reduce((a, r) => a + r.attacksUsed, 0),
    attacksTotal: war.teamSize * attacksAllowed,
    rows,
    missing,
    outstanding: missing.reduce((a, r) => a + r.unused, 0),
  };
}

/* -------------------------------------------------------------- war log */

/**
 * A war log entry can arrive with `result: null` — Clan War League rounds are
 * logged that way. Recover the outcome from the scoreline when we can, and
 * treat an entry with no scoreline at all as unreadable rather than a tie,
 * which would quietly poison the win rate.
 */
function resultOf(e: RawWarLogEntry): 'win' | 'lose' | 'tie' | null {
  if (e.result === 'win' || e.result === 'lose' || e.result === 'tie') return e.result;
  const us = e.clan?.stars ?? 0, them = e.opponent?.stars ?? 0;
  const usD = e.clan?.destructionPercentage ?? 0, themD = e.opponent?.destructionPercentage ?? 0;
  if (us === 0 && them === 0 && usD === 0 && themD === 0) return null;
  if (us !== them) return us > them ? 'win' : 'lose';
  if (usD !== themD) return usD > themD ? 'win' : 'lose';
  return 'tie';
}

export function normaliseWarLog(items: RawWarLogEntry[]): WarLogEntry[] {
  return items.flatMap((e) => {
    const result = resultOf(e);
    if (!result) return [];
    return [{
      result,
      endTime: e.endTime,
      teamSize: e.teamSize,
      opponentTag: e.opponent?.tag ?? null,
      opponentName: e.opponent?.name ?? 'Unknown',
      stars: e.clan?.stars ?? 0,
      opponentStars: e.opponent?.stars ?? 0,
      destruction: e.clan?.destructionPercentage ?? 0,
      opponentDestruction: e.opponent?.destructionPercentage ?? 0,
    }];
  });
}

export function summariseWarLog(entries: WarLogEntry[]): WarLogSummary {
  const wars = entries.length;
  if (!wars) {
    return { wars: 0, wins: 0, losses: 0, ties: 0, winRate: 0, avgStars: 0, avgDestruction: 0, bestStreak: 0 };
  }

  let wins = 0, losses = 0, ties = 0, run = 0, bestStreak = 0;
  for (const e of entries) {
    if (e.result === 'win') { wins++; run++; bestStreak = Math.max(bestStreak, run); }
    else { run = 0; if (e.result === 'lose') losses++; else ties++; }
  }

  return {
    wars, wins, losses, ties,
    winRate: (wins / wars) * 100,
    avgStars: entries.reduce((a, e) => a + e.stars, 0) / wars,
    avgDestruction: entries.reduce((a, e) => a + e.destruction, 0) / wars,
    bestStreak,
  };
}
