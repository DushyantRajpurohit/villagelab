import { describe, expect, it } from 'vitest';
import { analyseEquipment, analyseUnits, nameKey, summarise, summariseEquipment } from '../progress';
import { UNITS_BY_ID } from '../army';
import { EQUIPMENT_BY_ID, totalOre } from '../equipment';

const bk = UNITS_BY_ID.barbarian_king;
const hog = UNITS_BY_ID.hog_rider;

describe('nameKey', () => {
  it('matches API punctuation against our dataset names', () => {
    expect(nameKey('P.E.K.K.A')).toBe(nameKey('pekka'));
    expect(nameKey('L.A.S.S.I')).toBe(nameKey('lassi'));
    expect(nameKey('Barbarian King')).toBe('barbarianking');
  });
});

describe('analyseUnits', () => {
  it('reports level 0 and not-found for units the account lacks', () => {
    const rows = analyseUnits({ townHallLevel: 14, heroes: [], troops: [], spells: [] });
    const row = rows.find((r) => r.id === 'barbarian_king')!;
    expect(row.level).toBe(0);
    expect(row.found).toBe(false);
  });

  it('ignores Builder Base units, which share names with home village ones', () => {
    const rows = analyseUnits({
      townHallLevel: 14,
      troops: [
        { name: 'Barbarian', level: 20, village: 'builderBase' },
        { name: 'Barbarian', level: 11, village: 'home' },
      ],
    });
    expect(rows.find((r) => r.id === 'barbarian')!.level).toBe(11);
  });

  it('flags a unit below the previous Town Hall ceiling as rushed', () => {
    const th = 14;
    const rows = analyseUnits({
      townHallLevel: th,
      heroes: [{ name: 'Barbarian King', level: bk.max[th - 1] - 5, village: 'home' }],
    });
    expect(rows.find((r) => r.id === 'barbarian_king')!.rushed).toBe(true);
  });

  it('does not flag a unit that merely has room left at the current Town Hall', () => {
    const th = 14;
    const rows = analyseUnits({
      townHallLevel: th,
      heroes: [{ name: 'Barbarian King', level: bk.max[th - 1], village: 'home' }],
    });
    const row = rows.find((r) => r.id === 'barbarian_king')!;
    expect(row.rushed).toBe(false);
    expect(row.remainingCost).toBeGreaterThan(0);
  });

  it('reports zero remaining cost for a maxed unit', () => {
    const th = 14;
    const rows = analyseUnits({
      townHallLevel: th,
      troops: [{ name: 'Hog Rider', level: hog.max[th], village: 'home' }],
    });
    const row = rows.find((r) => r.id === 'hog_rider')!;
    expect(row.remainingCost).toBe(0);
    expect(row.pct).toBe(100);
  });

  it('only includes units unlocked at that Town Hall', () => {
    const low = analyseUnits({ townHallLevel: 5 });
    const high = analyseUnits({ townHallLevel: 15 });
    expect(low.length).toBeLessThan(high.length);
    expect(low.some((r) => r.id === 'royal_champion')).toBe(false);
  });
});

describe('summarise', () => {
  it('splits remaining cost by resource and never yields NaN', () => {
    const s = summarise(analyseUnits({ townHallLevel: 14 }));
    for (const v of Object.values(s.cost)) expect(Number.isFinite(v)).toBe(true);
    expect(Number.isFinite(s.totalHours)).toBe(true);
    expect(s.overallPct).toBeGreaterThanOrEqual(0);
    expect(s.overallPct).toBeLessThanOrEqual(100);
  });

  it('reports 100% when every unit is at its Town Hall cap', () => {
    const th = 12;
    const rows = analyseUnits({ townHallLevel: th });
    const maxed = rows.map((r) => ({ ...r, level: r.maxHere, pct: 100 }));
    expect(summarise(maxed).overallPct).toBeCloseTo(100);
  });

  it('handles an empty roster without dividing by zero', () => {
    const s = summarise([]);
    expect(s.overallPct).toBe(0);
    expect(s.maxedCount).toBe(0);
  });
});

describe('analyseEquipment', () => {
  it('treats an item missing from the API as unowned, not as level 0', () => {
    // Epics are bought, not granted. An account that never bought the Giant
    // Gauntlet has not "left it at level 0" — it does not have one.
    const rows = analyseEquipment({ townHallLevel: 16, heroEquipment: [] });
    const g = rows.find((r) => r.id === 'giant_gauntlet')!;
    expect(g.found).toBe(false);
    expect(g.level).toBe(0);
    // Quoted from level 1, because that is the level it would arrive at.
    expect(g.remainingOre).toEqual({ shiny: 56_060, glowy: 3_720, starry: 480 });
  });

  it('owes nothing on an item already at this hall\'s ceiling', () => {
    const th = 16;
    const cap = EQUIPMENT_BY_ID.giant_gauntlet.max[th];
    const rows = analyseEquipment({
      townHallLevel: th,
      heroEquipment: [{ name: 'Giant Gauntlet', level: cap, village: 'home' }],
    });
    const g = rows.find((r) => r.id === 'giant_gauntlet')!;
    expect(g.found).toBe(true);
    expect(g.pct).toBe(100);
    expect(totalOre(g.remainingOre)).toBe(0);
  });

  it('lists only what the Town Hall can reach', () => {
    const low = analyseEquipment({ townHallLevel: 5 });
    expect(low.some((r) => r.id === 'barbarian_puppet')).toBe(true);
    expect(low.some((r) => r.id === 'eternal_tome')).toBe(false);
    expect(low.every((r) => r.hero === 'barbarian_king')).toBe(true);
  });
});

describe('summariseEquipment', () => {
  it('keeps ore for what you have apart from ore for what you do not', () => {
    const th = 16;
    const rows = analyseEquipment({
      townHallLevel: th,
      heroEquipment: [{ name: 'Barbarian Puppet', level: 1, village: 'home' }],
    });
    const s = summariseEquipment(rows);
    expect(s.ownedCount).toBe(1);
    expect(s.ore).toEqual({ shiny: 27_260, glowy: 1_920 });
    // Everything else is quoted separately, so the two are never added.
    expect(totalOre(s.oreIfObtained)).toBeGreaterThan(totalOre(s.ore));
  });

  it('does not score an unbought epic as 0% progress', () => {
    const th = 16;
    const rows = analyseEquipment({
      townHallLevel: th,
      heroEquipment: [{ name: 'Barbarian Puppet', level: 18, village: 'home' }],
    });
    const s = summariseEquipment(rows);
    expect(s.overallPct).toBeCloseTo(100);
    expect(s.maxedCount).toBe(1);
  });

  it('handles an account with no equipment at all', () => {
    const s = summariseEquipment(analyseEquipment({ townHallLevel: 3 }));
    expect(s.rows).toEqual([]);
    expect(s.overallPct).toBe(0);
    expect(s.ore).toEqual({});
  });
});
