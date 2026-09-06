import { describe, expect, it } from 'vitest';
import {
  BUILDER_HEROES, BUILDER_TROOPS, BUILDER_UNITS, MAX_BH, builderUnitsAtBH,
} from '../builder-base';
import { analyseBuilderUnits, analyseUnits, summariseBuilder } from '../progress';
import { mockPlayer } from '@/lib/coc/mock';

describe('builder base dataset', () => {
  it('has a sane ceiling table for every unit', () => {
    for (const u of BUILDER_UNITS) {
      expect(u.unlockBH, u.id).toBeGreaterThanOrEqual(1);
      expect(u.unlockBH, u.id).toBeLessThanOrEqual(MAX_BH);
      expect(u.maxLevel, u.id).toBeGreaterThan(0);
      expect(u.max, u.id).toHaveLength(MAX_BH + 1);
      // Index 0 is unused padding so max[bh] reads naturally.
      expect(u.max[0], u.id).toBe(0);
    }
  });

  it('never lets a ceiling go down as the Builder Hall goes up', () => {
    for (const u of BUILDER_UNITS) {
      for (let bh = 2; bh <= MAX_BH; bh++) {
        expect(u.max[bh], `${u.id} at BH${bh}`).toBeGreaterThanOrEqual(u.max[bh - 1]);
      }
    }
  });

  it('locks every unit below its unlock hall', () => {
    for (const u of BUILDER_UNITS) {
      for (let bh = 1; bh < u.unlockBH; bh++) expect(u.max[bh], `${u.id} at BH${bh}`).toBe(0);
      expect(u.max[u.unlockBH], u.id).toBeGreaterThan(0);
    }
  });

  it('unlocks more the higher the hall', () => {
    for (let bh = 2; bh <= MAX_BH; bh++) {
      expect(builderUnitsAtBH(bh).length, `BH${bh}`)
        .toBeGreaterThanOrEqual(builderUnitsAtBH(bh - 1).length);
    }
    expect(builderUnitsAtBH(1)).toHaveLength(1);
    expect(builderUnitsAtBH(MAX_BH).length).toBe(BUILDER_UNITS.length);
  });

  it('has no duplicate ids', () => {
    const ids = BUILDER_UNITS.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('separates troops from heroes', () => {
    expect(BUILDER_TROOPS.every((u) => u.kind === 'troop')).toBe(true);
    expect(BUILDER_HEROES.every((u) => u.kind === 'hero')).toBe(true);
    expect(BUILDER_HEROES.map((h) => h.id)).toContain('battle_machine');
  });
});

describe('analyseBuilderUnits', () => {
  const player = (over: Partial<Parameters<typeof analyseBuilderUnits>[0]> = {}) => ({
    builderHallLevel: 9,
    troops: [{ name: 'Raged Barbarian', level: 18, village: 'builderBase' }],
    heroes: [{ name: 'Battle Machine', level: 25, village: 'builderBase' }],
    ...over,
  });

  it('returns nothing for an account with no second village', () => {
    expect(analyseBuilderUnits({ builderHallLevel: 0 })).toEqual([]);
    expect(analyseBuilderUnits({})).toEqual([]);
  });

  it('reads only builderBase units, never home village ones', () => {
    const rows = analyseBuilderUnits(player({
      troops: [
        { name: 'Raged Barbarian', level: 18, village: 'builderBase' },
        // A home-village Barbarian must not leak in and set a level here.
        { name: 'Barbarian', level: 12, village: 'home' },
      ],
    }));
    const barb = rows.find((r) => r.id === 'raged_barbarian')!;
    expect(barb.level).toBe(18);
    expect(rows.some((r) => r.name === 'Barbarian')).toBe(false);
  });

  it('ignores a unit with no village tag rather than assuming builderBase', () => {
    const rows = analyseBuilderUnits(player({
      troops: [{ name: 'Raged Barbarian', level: 18 } as never],
    }));
    expect(rows.find((r) => r.id === 'raged_barbarian')!.found).toBe(false);
  });

  it('only offers what the hall has unlocked', () => {
    const rows = analyseBuilderUnits(player({ builderHallLevel: 3 }));
    expect(rows.map((r) => r.id)).toEqual(['raged_barbarian', 'sneaky_archer', 'boxer_giant']);
  });

  it('marks a unit behind the previous hall as rushed', () => {
    const rows = analyseBuilderUnits(player({
      builderHallLevel: 9,
      // BH8 capped Raged Barbarian at 16, so level 10 is behind that.
      troops: [{ name: 'Raged Barbarian', level: 10, village: 'builderBase' }],
    }));
    expect(rows.find((r) => r.id === 'raged_barbarian')!.rushed).toBe(true);
  });

  it('distinguishes "locked" from "level zero"', () => {
    const rows = analyseBuilderUnits(player({ troops: [], heroes: [] }));
    expect(rows.every((r) => r.found === false)).toBe(true);
    expect(rows.every((r) => r.level === 0)).toBe(true);
  });

  it('matches loosely on punctuation, like the home village does', () => {
    const rows = analyseBuilderUnits(player({
      builderHallLevel: 10,
      troops: [{ name: 'Power PEKKA', level: 4, village: 'builderBase' }],
    }));
    expect(rows.find((r) => r.id === 'power_pekka')!.level).toBe(4);
  });
});

describe('summariseBuilder', () => {
  it('is empty-safe', () => {
    expect(summariseBuilder([])).toEqual({ rows: [], overallPct: 0, maxedCount: 0, rushedCount: 0 });
  });

  it('reports 100% for a fully maxed hall', () => {
    const rows = analyseBuilderUnits({
      builderHallLevel: 10,
      troops: BUILDER_TROOPS.map((u) => ({ name: u.name, level: u.max[10], village: 'builderBase' })),
      heroes: BUILDER_HEROES.map((u) => ({ name: u.name, level: u.max[10], village: 'builderBase' })),
    });
    const s = summariseBuilder(rows);
    expect(s.overallPct).toBeCloseTo(100);
    expect(s.maxedCount).toBe(rows.length);
    expect(s.rushedCount).toBe(0);
  });
});

describe('the two villages stay separate', () => {
  const tags = ['#2PP', '#9UJLQ0YU', '#VILLAGE', '#LQ8CVGRJ'];

  it('mock players carry a second village that analyses cleanly', () => {
    for (const tag of tags) {
      const p = mockPlayer(tag);
      expect(p.builderHallLevel, tag).toBeGreaterThanOrEqual(1);
      expect(p.builderHallLevel!, tag).toBeLessThanOrEqual(MAX_BH);

      const rows = analyseBuilderUnits(p);
      expect(rows.length, tag).toBeGreaterThan(0);
      for (const r of rows) {
        expect(r.level, `${tag} ${r.id}`).toBeLessThanOrEqual(r.maxHere);
        expect(r.pct, `${tag} ${r.id}`).toBeLessThanOrEqual(100);
      }
    }
  });

  it('keeps the two Baby Dragons apart', () => {
    // "Baby Dragon" is a real unit in *both* villages with different ceilings.
    // Each analysis builds its level map from its own village, which is the
    // only thing stopping one village's level from being scored against the
    // other's maximum.
    const player = {
      townHallLevel: 14,
      builderHallLevel: 10,
      troops: [
        { name: 'Baby Dragon', level: 7, village: 'home' },
        { name: 'Baby Dragon', level: 10, village: 'builderBase' },
      ],
    };

    const home = analyseUnits(player).find((r) => r.id === 'baby_dragon')!;
    const builder = analyseBuilderUnits(player).find((r) => r.id === 'baby_dragon')!;

    expect(home.level).toBe(7);
    expect(builder.level).toBe(10);
    expect(home.maxHere).not.toBe(builder.maxHere);
  });

  it('does not let a builder-only unit into home village progress', () => {
    for (const tag of tags) {
      const home = analyseUnits(mockPlayer(tag));
      const homeNames = new Set(home.map((r) => r.name));
      // Names unique to the second village must never show up on the first.
      for (const name of ['Raged Barbarian', 'Battle Machine', 'Cannon Cart', 'Hog Glider']) {
        expect(homeNames.has(name), `${tag} / ${name}`).toBe(false);
      }
    }
  });

  it('adding a second village does not move home village numbers', () => {
    // The filter in analyseUnits is what guarantees this; assert it directly.
    const p = mockPlayer('#2PP');
    const withBuilder = analyseUnits(p);
    const withoutBuilder = analyseUnits({
      ...p,
      troops: p.troops!.filter((t) => t.village !== 'builderBase'),
      heroes: p.heroes!.filter((h) => h.village !== 'builderBase'),
    });
    expect(withBuilder).toEqual(withoutBuilder);
  });
});
