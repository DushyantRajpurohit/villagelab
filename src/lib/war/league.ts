import { memberRows, standingOf } from './analyse';
import type {
  LeagueAnalysis, LeagueMemberSeason, LeagueRound, LeagueSide, LeagueStanding,
  LeagueWarRecord, RawLeagueClan, RawLeagueGroup, RawWar, RawWarSide, RoundStatus, Standing,
} from './types';

/**
 * Pure Clan War League analysis. Like `analyse.ts`, no React, no database and
 * no network: the ingestion worker folds each league war through
 * `recordLeagueWar` before storing it, and the league page folds the stored
 * group through `analyseLeague`.
 *
 * A league is not seven regular wars in a row, and the three ways it differs
 * are each modelled here rather than approximated:
 *
 *  - **The group is ranked, not the war.** A clan's place depends on wars it
 *    was not in, so every war in the group is kept, not only its own seven.
 *  - **A win is worth ten extra stars**, and the table is ranked on stars with
 *    the bonus included, then on total destruction.
 *  - **One attack each.** A member's stars are the stars they *added*, which is
 *    also how the game counts them for league medals: attacking a base that was
 *    already beaten does not contribute.
 */

/** Stars added to a clan's league total for winning a war. */
export const WIN_BONUS = 10;

/** The group's placeholder for a war not drawn yet. */
export const UNSCHEDULED = '#0';

export const scheduledTags = (group: RawLeagueGroup): string[] =>
  (group.rounds ?? []).flatMap((r) => r.warTags ?? []).filter((t) => t !== UNSCHEDULED);

/** 1-based round a war tag belongs to, or 0 if the group does not schedule it. */
export function roundOfWar(group: RawLeagueGroup, warTag: string): number {
  const i = (group.rounds ?? []).findIndex((r) => (r.warTags ?? []).includes(warTag));
  return i + 1;
}

/** Fold a league war down to what is stored: both sides, members folded to one row each. */
export function recordLeagueWar(war: RawWar, warTag: string, round: number): LeagueWarRecord {
  // A league war reports its attack allowance; one is the rule if it does not.
  const allowed = war.attacksPerMember ?? 1;
  const side = (s: RawWarSide): LeagueSide => ({
    tag: s.tag ?? '',
    name: s.name ?? 'Unknown',
    stars: s.stars ?? 0,
    destruction: s.destructionPercentage ?? 0,
    rows: memberRows(s, allowed),
  });
  return {
    warTag,
    round,
    state: war.state,
    teamSize: war.teamSize,
    startTime: war.startTime ?? null,
    endTime: war.endTime ?? null,
    sides: [side(war.clan), side(war.opponent)],
  };
}

/** The two sides with the named clan first, or null if it did not fight this war. */
export function orient(war: LeagueWarRecord, clanTag: string): [LeagueSide, LeagueSide] | null {
  const [a, b] = war.sides;
  if (a.tag === clanTag) return [a, b];
  if (b.tag === clanTag) return [b, a];
  return null;
}

const standingBetween = (us: LeagueSide, them: LeagueSide): Standing =>
  standingOf(
    { stars: us.stars, destructionPercentage: us.destruction },
    { stars: them.stars, destructionPercentage: them.destruction },
  );

const resultOf = (s: Standing): 'win' | 'lose' | 'tie' =>
  s === 'ahead' ? 'win' : s === 'behind' ? 'lose' : 'tie';

/** A war counts toward anything once battle day has begun. */
const underway = (w: LeagueWarRecord) => w.state === 'inWar' || w.state === 'warEnded';

/**
 * The group table.
 *
 * Destruction is summed per base — a war's average times its team size — rather
 * than averaged, because that is the figure the game accrues across a league
 * and breaks ties on. Within one group every war is the same size, so the
 * choice cannot reorder the table; it only keeps the number the one players
 * recognise.
 *
 * A war still being fought contributes its stars and destruction as they
 * stand, so the table shows where battle day is taking a clan. The win bonus,
 * and the win itself, wait for the war to end.
 */
export function leagueStandings(clans: RawLeagueClan[], wars: LeagueWarRecord[]): LeagueStanding[] {
  const table = new Map<string, LeagueStanding>(clans.map((c) => [c.tag, {
    rank: 0, tag: c.tag, name: c.name,
    stars: 0, bonus: 0, destruction: 0, wins: 0, losses: 0, ties: 0,
  }]));

  for (const w of wars) {
    if (!underway(w)) continue;
    const [a, b] = w.sides;
    for (const [me, them] of [[a, b], [b, a]] as const) {
      const row = table.get(me.tag);
      if (!row) continue;
      row.stars += me.stars;
      row.destruction += me.destruction * w.teamSize;
      if (w.state !== 'warEnded') continue;
      const s = standingBetween(me, them);
      if (s === 'ahead') { row.wins++; row.bonus += WIN_BONUS; row.stars += WIN_BONUS; }
      else if (s === 'behind') row.losses++;
      else row.ties++;
    }
  }

  return [...table.values()]
    .sort((x, y) => y.stars - x.stars || y.destruction - x.destruction || x.name.localeCompare(y.name))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/** The named clan's seven rounds, in order, whatever state each is in. */
export function leagueRounds(
  clanTag: string, group: RawLeagueGroup, wars: Map<string, LeagueWarRecord>,
): LeagueRound[] {
  return (group.rounds ?? []).map((r, i): LeagueRound => {
    const blank: LeagueRound = {
      round: i + 1, status: 'unscheduled', opponent: null,
      stars: 0, opponentStars: 0, destruction: 0, opponentDestruction: 0,
      result: null, standing: null, startTime: null, endTime: null,
    };

    const tags = (r.warTags ?? []).filter((t) => t !== UNSCHEDULED);
    if (!tags.length) return blank;

    let ours: { war: LeagueWarRecord; us: LeagueSide; them: LeagueSide } | null = null;
    for (const t of tags) {
      const war = wars.get(t);
      const sides = war && orient(war, clanTag);
      if (war && sides) { ours = { war, us: sides[0], them: sides[1] }; break; }
    }
    if (!ours) {
      // Only call it a bye once every war in the round is in hand; until then
      // the missing one may well be ours.
      return { ...blank, status: tags.every((t) => wars.has(t)) ? 'bye' : 'pending' };
    }

    const { war, us, them } = ours;
    const standing = underway(war) ? standingBetween(us, them) : null;
    return {
      round: i + 1,
      status: war.state as RoundStatus,
      opponent: { tag: them.tag, name: them.name },
      stars: us.stars,
      opponentStars: them.stars,
      destruction: us.destruction,
      opponentDestruction: them.destruction,
      result: war.state === 'warEnded' && standing ? resultOf(standing) : null,
      standing,
      startTime: war.startTime,
      endTime: war.endTime,
    };
  });
}

/**
 * Every member's league so far.
 *
 * An unused attack is split by whether it can still be used: `missed` in a war
 * that has ended, `owed` in one still being fought. They are different
 * conversations for a leader, and adding them would make a member who simply
 * has not attacked yet today look like one who skipped a war.
 */
export function leagueMembers(clanTag: string, wars: LeagueWarRecord[]): LeagueMemberSeason[] {
  const byTag = new Map<string, LeagueMemberSeason>();

  for (const w of [...wars].sort((a, b) => a.round - b.round)) {
    if (!underway(w)) continue;
    const sides = orient(w, clanTag);
    if (!sides) continue;
    for (const r of sides[0].rows) {
      const m = byTag.get(r.tag) ?? {
        tag: r.tag, name: r.name, townHallLevel: 0,
        wars: 0, attacksUsed: 0, missed: 0, owed: 0, stars: 0,
        totalDestruction: 0, avgDestruction: 0, defended: 0, starsConceded: 0,
      };
      // Rounds are replayed in order, so the name and hall are the latest seen.
      m.name = r.name;
      m.townHallLevel = r.townHallLevel;
      m.wars++;
      m.attacksUsed += r.attacksUsed;
      if (w.state === 'warEnded') m.missed += r.unused;
      else m.owed += r.unused;
      m.stars += r.stars;
      m.totalDestruction += r.bestDestruction;
      if (r.defenseStars !== null) { m.defended++; m.starsConceded += r.defenseStars; }
      byTag.set(r.tag, m);
    }
  }

  return [...byTag.values()]
    .map((m) => ({ ...m, avgDestruction: m.attacksUsed ? m.totalDestruction / m.attacksUsed : 0 }))
    .sort((a, b) => b.stars - a.stars || b.totalDestruction - a.totalDestruction
      || a.missed - b.missed || a.name.localeCompare(b.name));
}

export function analyseLeague(
  clanTag: string, group: RawLeagueGroup, wars: LeagueWarRecord[],
): LeagueAnalysis {
  // Only wars this group schedules. A stored war from another season, or a
  // group this clan has since left, must not leak into the table.
  const inGroup = new Set(scheduledTags(group));
  const held = wars.filter((w) => inGroup.has(w.warTag));
  const byTag = new Map(held.map((w) => [w.warTag, w]));

  const standings = leagueStandings(group.clans ?? [], held);
  const rounds = leagueRounds(clanTag, group, byTag);
  const members = leagueMembers(clanTag, held);

  let live: LeagueAnalysis['live'] = null;
  for (const w of held) {
    const sides = w.state === 'inWar' ? orient(w, clanTag) : null;
    if (!sides) continue;
    live = {
      round: w.round,
      opponent: sides[1].name,
      endTime: w.endTime,
      owing: sides[0].rows.filter((r) => r.unused > 0),
    };
  }

  return {
    season: group.season,
    state: group.state,
    clanTag,
    clanName: group.clans?.find((c) => c.tag === clanTag)?.name ?? '',
    groupSize: group.clans?.length ?? 0,
    roundsTotal: group.rounds?.length ?? 0,
    roundsPlayed: rounds.filter((r) => r.status === 'warEnded').length,
    standings,
    us: standings.find((s) => s.tag === clanTag) ?? null,
    rounds,
    members,
    live,
    attacksUsed: members.reduce((a, m) => a + m.attacksUsed, 0),
    attacksMissed: members.reduce((a, m) => a + m.missed, 0),
    attacksOwed: members.reduce((a, m) => a + m.owed, 0),
  };
}
