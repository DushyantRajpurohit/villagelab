import { describe, expect, it } from 'vitest';
import {
  BUILDER_BUILDINGS, BUILDER_HEROES, BUILDER_TROOPS, BUILDER_UNITS, MAX_BH,
  builderBuildingsAtBH, builderUnitsAtBH,
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
    // Builder Hall 3 raises the Builder Barracks to level 4, and each barracks
    // level unlocks one troop — so four are available, not three. Units are
    // ordered by the hall that unlocks them, then by name.
    const rows = analyseBuilderUnits(player({ builderHallLevel: 3 }));
    expect(rows.map((r) => r.id))
      .toEqual(['raged_barbarian', 'sneaky_archer', 'beta_minion', 'boxer_giant']);
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
    expect(summariseBuilder([])).toEqual({
      rows: [], overallPct: 0, maxedCount: 0, rushedCount: 0,
      totalHours: 0, cost: { gold: 0, elixir: 0 },
    });
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

describe('builder base buildings', () => {
  it('has a coherent count and ceiling table for every structure', () => {
    for (const b of BUILDER_BUILDINGS) {
      expect(b.count, b.id).toHaveLength(MAX_BH + 1);
      expect(b.max, b.id).toHaveLength(MAX_BH + 1);
      // Index 0 is unused padding so count[bh] reads naturally.
      expect(b.count[0], b.id).toBe(0);
      expect(b.size[0], b.id).toBeGreaterThan(0);
      expect(b.size[1], b.id).toBeGreaterThan(0);
      expect(b.unlockBH, b.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('never lets a count or a ceiling go down as the hall goes up', () => {
    for (const b of BUILDER_BUILDINGS) {
      for (let bh = 2; bh <= MAX_BH; bh++) {
        expect(b.count[bh], `${b.id} count at BH${bh}`).toBeGreaterThanOrEqual(b.count[bh - 1]);
        expect(b.max[bh], `${b.id} max at BH${bh}`).toBeGreaterThanOrEqual(b.max[bh - 1]);
      }
    }
  });

  it('prices every level a hall can actually reach', () => {
    // The two source tables are independent — counts and ceilings come from the
    // Builder Hall page, costs from each structure's own page — so a gap here
    // means they disagree, which is the one thing that would make the dataset
    // untrustworthy. Levels at or below the arrival level are deliberately
    // absent: they are not upgrades anyone buys.
    const gaps: string[] = [];
    for (const b of BUILDER_BUILDINGS) {
      for (let l = b.startLevel + 1; l <= b.max[MAX_BH]; l++) {
        if (!b.levels[l]) gaps.push(`${b.id}@${l}`);
      }
    }
    for (const u of BUILDER_UNITS) {
      for (let l = u.startLevel + 1; l <= u.max[MAX_BH]; l++) {
        if (!u.levels[l]) gaps.push(`${u.id}@${l}`);
      }
    }
    expect(gaps).toEqual([]);
  });

  it('hands a late-unlocking troop a part-levelled version, not a level 1', () => {
    // The Electrofire Wizard opens at Builder Hall 10 already at level 17 —
    // treating it as a level 1 would report a brand new troop as 0% done and
    // charge sixteen upgrades nobody ever buys.
    const wiz = BUILDER_UNITS.find((u) => u.id === 'electrofire_wizard')!;
    expect(wiz.startLevel).toBe(17);
    expect(wiz.levels[17]).toBeNull();
    expect(wiz.levels[18]?.cost).toBeGreaterThan(0);

    // The first troop is the exception that proves it: it does start at 1.
    expect(BUILDER_UNITS.find((u) => u.id === 'raged_barbarian')!.startLevel).toBe(1);
  });

  it('costs Builder Gold or Builder Elixir, never dark elixir', () => {
    for (const b of BUILDER_BUILDINGS) {
      expect(['gold', 'elixir'], b.id).toContain(b.resource);
    }
    for (const u of BUILDER_UNITS) {
      expect(['gold', 'elixir'], u.id).toContain(u.resource);
    }
  });

  it('is entirely anchored — no Builder Base figure is an estimate', () => {
    // The Home Village table is ~76% interpolated and says so with a "≈".
    // The Builder Base publishes every level, so nothing here may claim to be
    // an estimate; if this ever fails, the "≈" has to come back with it.
    const estimated: string[] = [];
    for (const b of BUILDER_BUILDINGS) {
      for (const l of b.levels) if (l?.est) estimated.push(`${b.id}@${l.level}`);
    }
    for (const u of BUILDER_UNITS) {
      for (const l of u.levels) if (l?.est) estimated.push(`${u.id}@${l.level}`);
    }
    expect(estimated).toEqual([]);
  });

  it('knows exactly which structures finish the instant you pay for them', () => {
    // Everything else takes a builder and real time. Pinning the exception list
    // means a future scrape that quietly zeroed a build time would fail here
    // rather than making the whole village look free to upgrade.
    const instant = BUILDER_BUILDINGS
      .filter((b) => {
        const top = b.levels[b.max[MAX_BH]];
        return top && top.cost > 0 && top.hours === 0;
      })
      .map((b) => b.id)
      .sort();

    // A wall ring is a purchase, not a build. The Battle Machine's altar is the
    // only altar in the game with a build time, so the Battle Copter's has
    // none. The B.O.B Control is bought outright to wake O.T.T.O.
    expect(instant).toEqual(['battle_copter_altar', 'bob_control', 'walls']);
  });

  it('unlocks more structures the higher the hall', () => {
    for (let bh = 2; bh <= MAX_BH; bh++) {
      expect(builderBuildingsAtBH(bh).length, `BH${bh}`)
        .toBeGreaterThanOrEqual(builderBuildingsAtBH(bh - 1).length);
    }
  });

  it('knows the structures that only the last halls can build', () => {
    const at = (bh: number) => new Set(builderBuildingsAtBH(bh).map((b) => b.id));
    expect(at(9).has('x_bow')).toBe(false);
    expect(at(10).has('x_bow')).toBe(true);
    expect(at(7).has('mega_tesla')).toBe(false);
    expect(at(8).has('mega_tesla')).toBe(true);
  });
});

describe('planning the second village', () => {
  it('offers a next step for every unit a hall has unlocked', () => {
    // The regression this guards: a unit that arrives part-levelled has a null
    // `levels[1]`, so treating an unrecorded unit as level 0 asked for a step
    // that does not exist and dropped every Builder Base troop out of the
    // planner's "available upgrades" list.
    for (let bh = 1; bh <= MAX_BH; bh++) {
      for (const u of builderUnitsAtBH(bh)) {
        const level = u.startLevel;
        if (level >= u.max[bh]) continue;
        expect(u.levels[level + 1], `${u.id} at BH${bh} from level ${level}`).toBeTruthy();
      }
    }
  });

  it('costs something real to take a freshly unlocked troop to its ceiling', () => {
    for (const u of BUILDER_UNITS) {
      const bh = u.unlockBH;
      if (u.max[bh] <= u.startLevel) continue;
      let cost = 0;
      for (let l = u.startLevel + 1; l <= u.max[bh]; l++) cost += u.levels[l]?.cost ?? 0;
      expect(cost, `${u.id} at BH${bh}`).toBeGreaterThan(0);
    }
  });

  it('gives every structure a next step from the level it is placed at', () => {
    for (let bh = 1; bh <= MAX_BH; bh++) {
      for (const b of builderBuildingsAtBH(bh)) {
        const from = Math.max(1, b.startLevel);
        if (from >= b.maxHere) continue;
        expect(b.levels[from + 1], `${b.id} at BH${bh}`).toBeTruthy();
      }
    }
  });
});
