import { describe, expect, it } from 'vitest';
import { buildLevels, costSeries } from '../curve';

describe('costSeries', () => {
  it('returns anchor values exactly, and marks them as not estimated', () => {
    const s = costSeries(10, { 1: 1000, 5: 20000, 10: 500000 });
    expect(s[1]).toEqual({ value: 1000, est: false });
    expect(s[5]).toEqual({ value: 20000, est: false });
    expect(s[10]).toEqual({ value: 500000, est: false });
  });

  it('marks interpolated levels as estimates', () => {
    const s = costSeries(10, { 1: 1000, 10: 500000 });
    expect(s[5]!.est).toBe(true);
  });

  it('interpolates monotonically between anchors', () => {
    const s = costSeries(20, { 1: 270, 8: 400000, 20: 19000000 });
    for (let l = 2; l <= 20; l++) {
      expect(s[l]!.value).toBeGreaterThanOrEqual(s[l - 1]!.value);
    }
  });

  it('extrapolates past the last anchor', () => {
    const s = costSeries(6, { 1: 100, 3: 400 });
    expect(s[6]!.value).toBeGreaterThan(s[3]!.value);
    expect(s[6]!.est).toBe(true);
  });

  it('throws rather than guessing when given no anchors', () => {
    expect(() => costSeries(5, {})).toThrow(/anchor/);
  });

  // Regression: geometric interpolation divides by the low anchor, so a zero
  // anchor produced NaN — and because every NaN comparison is false, ordering
  // checks passed while the data was broken. Walls (instant) and the Builder's
  // Hut (free at level 1) both legitimately anchor at zero.
  it('handles a zero low anchor without producing NaN', () => {
    const s = costSeries(4, { 1: 0, 4: 8_000_000 });
    for (let l = 1; l <= 4; l++) expect(Number.isFinite(s[l]!.value)).toBe(true);
    expect(s[1]!.value).toBe(0);
    expect(s[4]!.value).toBe(8_000_000);
    expect(s[2]!.value).toBeGreaterThan(0);
    expect(s[3]!.value).toBeGreaterThan(s[2]!.value);
  });

  it('keeps an all-zero series at zero instead of NaN', () => {
    const s = costSeries(17, { 1: 0, 17: 0 });
    expect(s.slice(1).every((e) => e!.value === 0)).toBe(true);
  });
});

describe('buildLevels', () => {
  it('leaves index 0 unused so levels index naturally', () => {
    const l = buildLevels(3, { 1: 100, 3: 900 }, { 1: 1, 3: 9 });
    expect(l[0]).toBeNull();
    expect(l[1]!.level).toBe(1);
    expect(l).toHaveLength(4);
  });

  it('flags a level as estimated when only the time was interpolated', () => {
    const l = buildLevels(3, { 1: 100, 2: 300, 3: 900 }, { 1: 1, 3: 9 });
    expect(l[2]!.est).toBe(true);
  });
});
