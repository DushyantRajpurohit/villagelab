import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../buildings';
import { ALL_UNITS } from '../army';

/**
 * Geometric interpolation is undefined when an anchor is zero — it silently
 * produces NaN, and NaN fails every comparison quietly (`NaN < x` is false), so
 * an ordering check will not catch it. Assert finiteness explicitly.
 */
describe('every level has usable numbers', () => {
  const all = [...BUILDINGS, ...ALL_UNITS];
  it.each(all.map((x) => [x.name, x] as const))('%s', (_name, x) => {
    const bad = x.levels
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => l && (!Number.isFinite(l.cost) || !Number.isFinite(l.hours)));
    expect(bad.map(({ i, l }) => `lvl${i}: cost=${l!.cost} hours=${l!.hours}`)).toEqual([]);
  });
});

describe('the two cases that actually broke', () => {
  it('walls are instant at every level, not NaN', () => {
    const wall = BUILDINGS.find((b) => b.id === 'wall')!;
    for (let l = 1; l <= wall.maxLevel; l++) expect(wall.levels[l]!.hours).toBe(0);
  });

  it("a Builder's Hut has finite, rising costs above level 1", () => {
    const hut = BUILDINGS.find((b) => b.id === 'builders_hut')!;
    for (let l = 2; l <= hut.maxLevel; l++) {
      expect(Number.isFinite(hut.levels[l]!.cost)).toBe(true);
      expect(hut.levels[l]!.cost).toBeGreaterThan(hut.levels[l - 1]!.cost);
    }
  });
});
