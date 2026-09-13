import { describe, expect, it } from 'vitest';
import {
  UNSCHEDULED, WIN_BONUS, analyseLeague, leagueMembers, leagueRounds, leagueStandings, orient,
  recordLeagueWar, roundOfWar, scheduledTags,
} from '../league';
import type { LeagueSide, LeagueWarRecord, RawLeagueGroup, WarMemberRow, WarState } from '../types';
import { mockLeague, roundRobin } from '@/lib/coc/mock';

const row = (tag: string, over: Partial<WarMemberRow> = {}): WarMemberRow => ({
  tag, name: tag, townHallLevel: 15, mapPosition: 1,
  attacksUsed: 1, attacksAllowed: 1, unused: 0, stars: 0, bestDestruction: 0,
  defenseStars: null, defenseDestruction: null, ...over,
});

const side = (tag: string, stars: number, destruction: number, rows: WarMemberRow[] = []): LeagueSide =>
  ({ tag, name: tag, stars, destruction, rows });

const war = (
  warTag: string, round: number, state: WarState, a: LeagueSide, b: LeagueSide, teamSize = 15,
): LeagueWarRecord => ({ warTag, round, state, teamSize, startTime: null, endTime: null, sides: [a, b] });

const clans = ['#A', '#B', '#C', '#D'].map((tag) => ({ tag, name: tag }));

describe('round robin', () => {
  it('meets every pair exactly once, one war each per round', () => {
    const rounds = roundRobin(8);
    expect(rounds).toHaveLength(7);
    const seen = new Set<string>();
    for (const pairs of rounds) {
      expect(pairs).toHaveLength(4);
      expect(new Set(pairs.flat()).size).toBe(8);
      for (const [x, y] of pairs) seen.add([x, y].sort().join('-'));
    }
    expect(seen.size).toBe(28);
  });
});

describe('standings', () => {
  it('adds the win bonus only to the winner of a finished war', () => {
    const t = leagueStandings(clans, [
      war('#W1', 1, 'warEnded', side('#A', 30, 80), side('#B', 25, 70)),
      war('#W2', 1, 'inWar', side('#C', 40, 90), side('#D', 10, 30)),
    ]);
    const by = Object.fromEntries(t.map((s) => [s.tag, s]));
    expect(by['#A']).toMatchObject({ stars: 30 + WIN_BONUS, bonus: WIN_BONUS, wins: 1 });
    expect(by['#B']).toMatchObject({ stars: 25, bonus: 0, losses: 1 });
    // Leading a war still being fought earns its stars, not the bonus.
    expect(by['#C']).toMatchObject({ stars: 40, bonus: 0, wins: 0 });
  });

  it('gives neither side a bonus for a tie', () => {
    const t = leagueStandings(clans, [war('#W', 1, 'warEnded', side('#A', 30, 80), side('#B', 30, 80))]);
    expect(t.filter((s) => s.bonus > 0)).toEqual([]);
    expect(t.find((s) => s.tag === '#A')!.ties).toBe(1);
  });

  it('decides a war on destruction when stars are level', () => {
    const t = leagueStandings(clans, [war('#W', 1, 'warEnded', side('#A', 30, 81), side('#B', 30, 80))]);
    expect(t.find((s) => s.tag === '#A')!.wins).toBe(1);
  });

  it('ranks on stars, then destruction summed across bases', () => {
    const t = leagueStandings(clans, [
      war('#W1', 1, 'warEnded', side('#A', 20, 60), side('#B', 30, 90)),
      war('#W2', 1, 'warEnded', side('#C', 20, 80), side('#D', 30, 90)),
    ]);
    expect(t.map((s) => s.tag)).toEqual(['#B', '#D', '#C', '#A']);
    // 80% across fifteen bases is 1,200% accrued, not 80.
    expect(t.find((s) => s.tag === '#C')!.destruction).toBeCloseTo(1200);
  });

  it('ignores preparation day entirely', () => {
    const t = leagueStandings(clans, [war('#W', 1, 'preparation', side('#A', 0, 0), side('#B', 0, 0))]);
    expect(t.every((s) => s.stars === 0 && s.wins + s.losses + s.ties === 0)).toBe(true);
  });
});

describe('rounds', () => {
  const group: RawLeagueGroup = {
    state: 'inWar', season: '2026-09', clans,
    rounds: [
      { warTags: ['#W1', '#W2'] },
      { warTags: ['#W3', '#W4'] },
      { warTags: ['#W5'] },
      { warTags: [UNSCHEDULED, UNSCHEDULED] },
    ],
  };
  const held = new Map([
    // We are listed second: orientation must not depend on the API's order.
    ['#W1', war('#W1', 1, 'warEnded', side('#B', 20, 60), side('#A', 28, 85))],
    ['#W2', war('#W2', 1, 'warEnded', side('#C', 1, 1), side('#D', 2, 2))],
    ['#W3', war('#W3', 2, 'inWar', side('#A', 12, 40), side('#C', 15, 50))],
    ['#W5', war('#W5', 3, 'warEnded', side('#B', 1, 1), side('#D', 2, 2))],
  ]);

  it('reads each round from our side, whatever order the API used', () => {
    const [r1, r2, r3, r4] = leagueRounds('#A', group, held);
    expect(r1).toMatchObject({ status: 'warEnded', result: 'win', stars: 28, opponentStars: 20, opponent: { tag: '#B' } });
    expect(r2).toMatchObject({ status: 'inWar', result: null, standing: 'behind' });
    expect(r3.status).toBe('bye');
    expect(r4.status).toBe('unscheduled');
  });

  it('holds off calling a bye while one of the round\'s wars is unfetched', () => {
    const partial = new Map([...held].filter(([t]) => t !== '#W3'));
    expect(leagueRounds('#A', group, partial)[1].status).toBe('pending');
  });

  it('maps a war tag to its round, and skips placeholders', () => {
    expect(roundOfWar(group, '#W4')).toBe(2);
    expect(roundOfWar(group, '#NOPE')).toBe(0);
    expect(scheduledTags(group)).not.toContain(UNSCHEDULED);
  });
});

describe('members', () => {
  it('splits missed attacks from attacks still to use', () => {
    const members = leagueMembers('#A', [
      war('#W1', 1, 'warEnded', side('#A', 3, 100, [row('#P', { attacksUsed: 0, unused: 1 })]), side('#B', 0, 0)),
      war('#W2', 2, 'inWar', side('#A', 0, 0, [row('#P', { attacksUsed: 0, unused: 1 })]), side('#C', 0, 0)),
    ]);
    expect(members[0]).toMatchObject({ wars: 2, attacksUsed: 0, missed: 1, owed: 1 });
  });

  it('counts a base nobody attacked as clean, not as zero conceded', () => {
    const [m] = leagueMembers('#A', [
      war('#W1', 1, 'warEnded', side('#A', 0, 0, [row('#P', { defenseStars: null })]), side('#B', 0, 0)),
      war('#W2', 2, 'warEnded', side('#A', 0, 0, [row('#P', { defenseStars: 0, defenseDestruction: 40 })]), side('#C', 0, 0)),
    ]);
    expect(m).toMatchObject({ defended: 1, starsConceded: 0 });
  });

  it('averages destruction over attacks used, not wars played', () => {
    const [m] = leagueMembers('#A', [
      war('#W1', 1, 'warEnded', side('#A', 0, 0, [row('#P', { bestDestruction: 90 })]), side('#B', 0, 0)),
      war('#W2', 2, 'warEnded', side('#A', 0, 0, [row('#P', { attacksUsed: 0, unused: 1 })]), side('#C', 0, 0)),
    ]);
    expect(m.avgDestruction).toBe(90);
  });
});

describe('against mock data', () => {
  // Mid-league, finished (#L29P2) and not yet started (#Y89P2): the seed places
  // each tag somewhere in the season, and the sample needs all three.
  const tags = ['#2PP', '#9UJLQ0YU', '#VILLAGE', '#L29P2', '#Y89P2'];

  // A mock league generates 28 wars; build each tag's once for the whole block.
  const cache = new Map<string, ReturnType<typeof build>>();
  const build = (tag: string) => {
    const { group, wars } = mockLeague(tag);
    const records = Object.entries(wars).map(([t, w]) => recordLeagueWar(w, t, roundOfWar(group, t)));
    return { group, records, league: analyseLeague(group.clans[0].tag, group, records) };
  };
  const analysed = (tag: string) => {
    if (!cache.has(tag)) cache.set(tag, build(tag));
    return cache.get(tag)!;
  };

  it('generates a group of eight with seven rounds of four', () => {
    for (const tag of tags) {
      const { group } = analysed(tag);
      expect(group.clans, tag).toHaveLength(8);
      expect(new Set(group.clans.map((c) => c.tag)).size, tag).toBe(8);
      expect(group.rounds, tag).toHaveLength(7);
      for (const r of group.rounds) expect(r.warTags, tag).toHaveLength(4);
      expect(new Set(scheduledTags(group)).size, tag).toBe(scheduledTags(group).length);
    }
  });

  it('awards exactly the stars fought for, plus ten per decisive war', () => {
    for (const tag of tags) {
      const { records, league } = analysed(tag);
      const live = records.filter((w) => w.state === 'inWar' || w.state === 'warEnded');
      const fought = live.reduce((a, w) => a + w.sides[0].stars + w.sides[1].stars, 0);
      const decisive = live.filter((w) => w.state === 'warEnded'
        && (w.sides[0].stars !== w.sides[1].stars || w.sides[0].destruction !== w.sides[1].destruction)).length;
      const total = league.standings.reduce((a, s) => a + s.stars, 0);
      expect(total, tag).toBe(fought + WIN_BONUS * decisive);
    }
  });

  it('credits members with exactly their clan\'s stars', () => {
    for (const tag of tags) {
      const { records, league } = analysed(tag);
      const ours = records
        .filter((w) => w.state === 'inWar' || w.state === 'warEnded')
        .map((w) => orient(w, league.clanTag))
        .reduce((a, s) => a + (s ? s[0].stars : 0), 0);
      expect(league.members.reduce((a, m) => a + m.stars, 0), tag).toBe(ours);
      expect(league.us!.stars - league.us!.bonus, tag).toBe(ours);
    }
  });

  it('keeps the league\'s record and its rounds in agreement', () => {
    for (const tag of tags) {
      const { league } = analysed(tag);
      const us = league.us!;
      expect(us.wins + us.losses + us.ties, tag).toBe(league.roundsPlayed);
      expect(league.rounds.filter((r) => r.result === 'win').length, tag).toBe(us.wins);
      expect(league.standings.map((s) => s.rank), tag).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      // One attack each: nobody can use more attacks than wars they played.
      for (const m of league.members) {
        expect(m.attacksUsed + m.missed + m.owed, `${tag} ${m.tag}`).toBe(m.wars);
      }
    }
  });

  it('only reports a live round while one is being fought', () => {
    for (const tag of tags) {
      const { league } = analysed(tag);
      expect(league.live !== null, tag).toBe(league.rounds.some((r) => r.status === 'inWar'));
      if (league.state === 'ended') expect(league.roundsPlayed, tag).toBe(7);
    }
  });

  it('covers a league before, during and after its rounds', () => {
    const states = new Set(tags.map((t) => analysed(t).group.state));
    expect([...states].sort()).toEqual(['ended', 'inWar', 'preparation']);
  });

  it('has nothing to score before round one starts', () => {
    const { league } = analysed('#Y89P2');
    expect(league.state).toBe('preparation');
    expect(league.members).toEqual([]);
    expect(league.standings.every((s) => s.stars === 0)).toBe(true);
    expect(league.rounds[0].status).toBe('preparation');
  });
});
