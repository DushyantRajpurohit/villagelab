import { describe, expect, it } from 'vitest';
import { MAX_TH, TOWN_HALLS } from '../town-halls';
import { BUILDINGS, BUILDINGS_BY_ID } from '../buildings';
import { ALL_UNITS } from '../army';

/**
 * These do not verify values against the wiki — they catch the mistakes that
 * are easy to make while correcting curated data: a max level that goes
 * backwards, a count that drops at a higher Town Hall, a unit that unlocks
 * before the building which produces it.
 */

const nonDecreasing = (arr: number[], label: string) => {
  for (let th = 2; th <= MAX_TH; th++) {
    expect(arr[th], `${label} drops from TH${th - 1} to TH${th}`).toBeGreaterThanOrEqual(arr[th - 1]);
  }
};

describe('town halls', () => {
  it('cost and build time never go backwards', () => {
    for (let th = 2; th <= MAX_TH; th++) {
      expect(TOWN_HALLS[th]!.cost).toBeGreaterThan(TOWN_HALLS[th - 1]!.cost);
      expect(TOWN_HALLS[th]!.hours).toBeGreaterThanOrEqual(TOWN_HALLS[th - 1]!.hours);
    }
  });
});

describe.each(BUILDINGS.map((b) => [b.name, b] as const))('building: %s', (_name, b) => {
  it('count and max level never decrease with Town Hall', () => {
    nonDecreasing(b.count, `${b.name} count`);
    nonDecreasing(b.max, `${b.name} max`);
  });

  it('has a dense level table matching its max level', () => {
    expect(b.maxLevel).toBe(Math.max(...b.max));
    expect(b.levels).toHaveLength(b.maxLevel + 1);
    for (let l = 1; l <= b.maxLevel; l++) expect(b.levels[l]).not.toBeNull();
  });

  it('costs increase with level', () => {
    for (let l = 2; l <= b.maxLevel; l++) {
      expect(b.levels[l]!.cost).toBeGreaterThanOrEqual(b.levels[l - 1]!.cost);
    }
  });
});

describe.each(ALL_UNITS.map((u) => [u.name, u] as const))('unit: %s', (_name, u) => {
  it('max level never decreases with Town Hall', () => nonDecreasing(u.max, `${u.name} max`));

  it('has a dense level table and increasing costs', () => {
    expect(u.levels).toHaveLength(u.maxLevel + 1);
    for (let l = 2; l <= u.maxLevel; l++) {
      expect(u.levels[l]!.cost).toBeGreaterThanOrEqual(u.levels[l - 1]!.cost);
    }
  });

  it('does not unlock before the building that produces it', () => {
    const dep =
      u.kind === 'troop' && u.resource === 'dark' ? 'dark_barracks'
      : u.kind === 'spell' && u.resource === 'dark' ? 'dark_spell_factory'
      : u.kind === 'troop' ? 'barracks'
      : u.kind === 'spell' ? 'spell_factory'
      : u.kind === 'siege' ? 'workshop'
      : u.kind === 'pet' ? 'pet_house'
      : null;
    if (!dep) return;
    expect(u.unlockTH).toBeGreaterThanOrEqual(BUILDINGS_BY_ID[dep].unlockTH);
  });
});

describe('estimate coverage', () => {
  it('reports how much of the dataset is interpolated', () => {
    const all = [...BUILDINGS, ...ALL_UNITS];
    const total = all.reduce((n, x) => n + x.maxLevel, 0);
    const est = all.reduce((n, x) => n + x.levels.filter((l) => l?.est).length, 0);
    // Guard-rail, not a target: if this jumps, someone deleted anchors.
    expect(est / total).toBeLessThan(0.85);
    console.log(`dataset: ${total} levels, ${total - est} anchored, ${est} interpolated`);
  });
});
