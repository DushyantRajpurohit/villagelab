import { describe, expect, it } from 'vitest';
import { keepLifetime, lifetimeRecords, LIFETIME_ACHIEVEMENTS } from '../achievements';
import { mockPlayer } from '../mock';

describe('lifetimeRecords', () => {
  it('reads each record from its achievement', () => {
    const records = lifetimeRecords([
      { name: 'Aggressive Capitalism', value: 1_250_000 },
      { name: 'War League Legend', value: 312 },
    ]);
    const byId = Object.fromEntries(records.map((r) => [r.id, r.value]));
    expect(byId.capitalLooted).toBe(1_250_000);
    expect(byId.leagueStars).toBe(312);
  });

  it('keeps a missing achievement apart from a zero', () => {
    const records = lifetimeRecords([{ name: 'Games Champion', value: 0 }]);
    const byId = Object.fromEntries(records.map((r) => [r.id, r.value]));
    expect(byId.clanGames).toBe(0);
    expect(byId.capitalContributed).toBeNull();
  });

  it('answers null everywhere when the API sent no achievements', () => {
    expect(lifetimeRecords(undefined).every((r) => r.value === null)).toBe(true);
  });
});

describe('keepLifetime', () => {
  it('stores only what the page reads', () => {
    const kept = keepLifetime([
      { name: 'Bigger Coffers', value: 10, stars: 3, village: 'home' },
      { name: 'Games Champion', value: 40_000, stars: 2, village: 'home' },
    ]);
    expect(kept).toEqual([{ name: 'Games Champion', value: 40_000, stars: 2 }]);
  });
});

describe('mock players', () => {
  it('carry every lifetime achievement, so the mock app shows the panel', () => {
    const names = mockPlayer('#2PP0JCVL9').achievements!.map((a) => a.name);
    expect([...names].sort()).toEqual([...LIFETIME_ACHIEVEMENTS].sort());
  });
});
