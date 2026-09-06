import { describe, expect, it } from 'vitest';
import { analyseWar, memberRows, normaliseWarLog, spreadOf, standingOf, summariseWarLog } from '../analyse';
import type { RawWar, RawWarLogEntry, RawWarSide } from '../types';
import { mockWar, mockWarLog } from '@/lib/coc/mock';

const side = (over: Partial<RawWarSide> = {}): RawWarSide => ({
  tag: '#US', name: 'Us', stars: 0, destructionPercentage: 0, members: [], ...over,
});

const member = (tag: string, pos: number, th = 15, attacks: RawWar['clan']['members'] extends undefined ? never : never[] = []) =>
  ({ tag, name: tag, townhallLevel: th, mapPosition: pos, attacks: attacks as never });

describe('star credit', () => {
  it('credits only the stars an attack actually added', () => {
    // Two hits on the same base: a 2-star then a 3-star is worth 2 + 1, not 2 + 3.
    const rows = memberRows(side({
      members: [
        { tag: '#A', name: 'A', townhallLevel: 15, mapPosition: 1,
          attacks: [{ attackerTag: '#A', defenderTag: '#X', stars: 2, destructionPercentage: 70, order: 1 }] },
        { tag: '#B', name: 'B', townhallLevel: 15, mapPosition: 2,
          attacks: [{ attackerTag: '#B', defenderTag: '#X', stars: 3, destructionPercentage: 100, order: 2 }] },
      ],
    }), 2);

    expect(rows.map((r) => r.stars)).toEqual([2, 1]);
  });

  it('gives a cleanup hitter nothing when the base was already maxed', () => {
    const rows = memberRows(side({
      members: [
        { tag: '#A', name: 'A', townhallLevel: 15, mapPosition: 1,
          attacks: [{ attackerTag: '#A', defenderTag: '#X', stars: 3, destructionPercentage: 100, order: 1 }] },
        { tag: '#B', name: 'B', townhallLevel: 15, mapPosition: 2,
          attacks: [{ attackerTag: '#B', defenderTag: '#X', stars: 3, destructionPercentage: 100, order: 2 }] },
      ],
    }), 2);

    expect(rows.map((r) => r.stars)).toEqual([3, 0]);
  });

  it('replays in war order, not array order', () => {
    // Same two attacks, listed with the later one first.
    const rows = memberRows(side({
      members: [
        { tag: '#B', name: 'B', townhallLevel: 15, mapPosition: 2,
          attacks: [{ attackerTag: '#B', defenderTag: '#X', stars: 3, destructionPercentage: 100, order: 9 }] },
        { tag: '#A', name: 'A', townhallLevel: 15, mapPosition: 1,
          attacks: [{ attackerTag: '#A', defenderTag: '#X', stars: 1, destructionPercentage: 45, order: 4 }] },
      ],
    }), 2);

    expect(Object.fromEntries(rows.map((r) => [r.tag, r.stars]))).toEqual({ '#A': 1, '#B': 2 });
  });
});

describe('member rows', () => {
  it('counts unused attacks and orders by map position', () => {
    const rows = memberRows(side({
      members: [
        { tag: '#C', name: 'C', townhallLevel: 14, mapPosition: 3, attacks: [] },
        { tag: '#A', name: 'A', townhallLevel: 16, mapPosition: 1,
          attacks: [{ attackerTag: '#A', defenderTag: '#X', stars: 3, destructionPercentage: 100 }] },
      ],
    }), 2);

    expect(rows.map((r) => r.mapPosition)).toEqual([1, 3]);
    expect(rows.map((r) => r.unused)).toEqual([1, 2]);
  });

  it('reports an unattacked base as null defence, not zero', () => {
    const [held, hit] = memberRows(side({
      members: [
        { tag: '#A', name: 'A', townhallLevel: 15, mapPosition: 1 },
        { tag: '#B', name: 'B', townhallLevel: 15, mapPosition: 2,
          bestOpponentAttack: { attackerTag: '#Z', defenderTag: '#B', stars: 0, destructionPercentage: 22 } },
      ],
    }), 2);

    expect(held.defenseStars).toBeNull();
    expect(hit.defenseStars).toBe(0);
    expect(hit.defenseDestruction).toBe(22);
  });

  it('honours the one-attack limit of Clan War Leagues', () => {
    const war: RawWar = {
      state: 'inWar', teamSize: 15, attacksPerMember: 1,
      clan: side({ members: [{ tag: '#A', name: 'A', townhallLevel: 15, mapPosition: 1, attacks: [] }] }),
      opponent: side({ tag: '#THEM', name: 'Them' }),
    };
    const a = analyseWar(war);
    expect(a.attacksPerMember).toBe(1);
    expect(a.attacksTotal).toBe(15);
    expect(a.rows[0].unused).toBe(1);
  });
});

describe('standing', () => {
  const s = (stars: number, dest: number) => side({ stars, destructionPercentage: dest });

  it('decides on stars first', () => {
    expect(standingOf(s(30, 50), s(29, 99))).toBe('ahead');
    expect(standingOf(s(29, 99), s(30, 50))).toBe('behind');
  });

  it('falls through to destruction, then calls it level', () => {
    expect(standingOf(s(30, 91.5), s(30, 91.4))).toBe('ahead');
    expect(standingOf(s(30, 91.5), s(30, 91.5))).toBe('level');
  });
});

describe('town hall spread', () => {
  it('counts descending by Town Hall', () => {
    expect(spreadOf(side({
      members: [member('#A', 1, 16), member('#B', 2, 15), member('#C', 3, 16)],
    }))).toEqual([[16, 2], [15, 1]]);
  });
});

describe('war log', () => {
  it('recovers a missing result from the scoreline', () => {
    const entries = normaliseWarLog([{
      result: null, endTime: '20240115T103000.000Z', teamSize: 15,
      clan: side({ stars: 40, destructionPercentage: 95 }),
      opponent: side({ tag: '#T', name: 'T', stars: 38, destructionPercentage: 93 }),
    }]);
    expect(entries[0].result).toBe('win');
  });

  it('drops an entry with no readable scoreline rather than scoring it a tie', () => {
    const blank: RawWarLogEntry = {
      result: null, endTime: '20240115T103000.000Z', teamSize: 15,
      clan: side(), opponent: side({ tag: null as never, name: undefined }),
    };
    expect(normaliseWarLog([blank])).toEqual([]);
  });

  it('summarises record, averages and best streak', () => {
    const e = (result: 'win' | 'lose' | 'tie', stars: number, dest: number) => ({
      result, endTime: '', teamSize: 15, opponentTag: null, opponentName: 'x',
      stars, opponentStars: 0, destruction: dest, opponentDestruction: 0,
    });
    const s = summariseWarLog([
      e('win', 30, 90), e('win', 40, 100), e('lose', 20, 60), e('win', 30, 80), e('tie', 30, 70),
    ]);

    expect([s.wins, s.losses, s.ties]).toEqual([3, 1, 1]);
    expect(s.winRate).toBeCloseTo(60);
    expect(s.avgStars).toBeCloseTo(30);
    expect(s.avgDestruction).toBeCloseTo(80);
    expect(s.bestStreak).toBe(2);
  });

  it('is safe on an empty log', () => {
    expect(summariseWarLog([])).toMatchObject({ wars: 0, winRate: 0, avgStars: 0 });
  });
});

describe('against mock data', () => {
  const tags = ['#2PP', '#9UJLQ0YU', '#VILLAGE', '#LQ8CVGRJ'];

  it('per-member star credit adds up to the clan total', () => {
    for (const tag of tags) {
      const a = analyseWar(mockWar(tag));
      expect(a.rows.reduce((s, r) => s + r.stars, 0), tag).toBe(a.us.stars);
    }
  });

  it('never reports more attacks than the war allows', () => {
    for (const tag of tags) {
      const a = analyseWar(mockWar(tag));
      expect(a.attacksUsed).toBeLessThanOrEqual(a.attacksTotal);
      expect(a.us.stars).toBeLessThanOrEqual(a.maxStars);
      expect(a.rows).toHaveLength(a.teamSize);
    }
  });

  it('has no attacks during preparation day', () => {
    const prep = tags.map(mockWar).find((w) => w.state === 'preparation')
      ?? mockWar('#PREPARATION');
    if (prep.state !== 'preparation') return; // deterministic; nothing to assert
    const a = analyseWar(prep);
    expect(a.attacksUsed).toBe(0);
    expect(a.outstanding).toBe(a.attacksTotal);
  });

  it('produces a war log that summarises cleanly', () => {
    const s = summariseWarLog(normaliseWarLog(mockWarLog('#2PP', 20)));
    expect(s.wars).toBe(20);
    expect(s.wins + s.losses + s.ties).toBe(20);
    expect(s.avgDestruction).toBeGreaterThan(0);
  });

  it('keeps war log destruction consistent with the scoreline', () => {
    // A war won 54-51 cannot show 60% destruction against the opponent's 92%.
    // Destruction is generated from the star ratio, so it must stay in band.
    for (const tag of tags) {
      for (const e of normaliseWarLog(mockWarLog(tag, 25))) {
        const max = e.teamSize * 3;
        expect(e.stars, tag).toBeLessThanOrEqual(max);
        expect(e.opponentStars, tag).toBeLessThanOrEqual(max);
        expect(Math.abs(e.destruction - (25 + 75 * (e.stars / max))), tag).toBeLessThanOrEqual(12);
        if (e.result === 'win') expect(e.stars, tag).toBeGreaterThanOrEqual(e.opponentStars);
        if (e.result === 'lose') expect(e.stars, tag).toBeLessThanOrEqual(e.opponentStars);
      }
    }
  });
});
