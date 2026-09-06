/**
 * Cost/time curve helper.
 *
 * Clash of Clans upgrade costs grow close to geometrically within a building's
 * level range, with occasional re-baselines when a new Town Hall introduces a
 * batch of levels. We therefore store *anchors* — levels whose real values are
 * known with confidence — and interpolate the gaps.
 *
 * Every generated (non-anchor) value is flagged `est: true` so the UI can render
 * it with a "≈" and nobody mistakes an interpolation for a wiki-accurate number.
 */

/** Sparse map of level -> known value. */
export type Anchors = Record<number, number>;

export interface LevelStep {
  level: number;
  cost: number;
  hours: number;
  /** True when either cost or time was interpolated rather than anchored. */
  est: boolean;
}

interface SeriesEntry {
  value: number;
  est: boolean;
}

/** Round to a sensible resource granularity so estimates don't look fake-precise. */
function roundResource(v: number): number {
  if (v < 1000) return Math.round(v / 10) * 10;
  if (v < 100_000) return Math.round(v / 1000) * 1000;
  if (v < 1_000_000) return Math.round(v / 10_000) * 10_000;
  return Math.round(v / 100_000) * 100_000;
}

/** Round hours to a granularity the game actually uses. */
function roundHours(h: number): number {
  if (h < 1) return Math.round(h * 60) / 60;
  if (h < 24) return Math.round(h * 2) / 2;
  if (h < 24 * 7) return Math.round(h);
  return Math.round(h / 12) * 12;
}

/**
 * Interpolate between two anchor values.
 *
 * Geometric growth matches how the game actually scales, but it is undefined
 * when an endpoint is zero — `b / 0` is Infinity and `0 * Infinity` is NaN.
 * Zero anchors are real (walls are instant, a Builder's Hut costs nothing at
 * level 1), so fall back to linear whenever either endpoint is non-positive.
 */
function interpolate(a: number, b: number, t: number): number {
  if (a > 0 && b > 0) return a * Math.pow(b / a, t);
  return a + (b - a) * t;
}

/** Average per-level multiplier at the head or tail of the anchor set. */
function growthRate(anchors: Anchors, keys: number[], where: 'head' | 'tail'): number {
  if (keys.length < 2) return 1.5; // lone anchor: assume typical CoC growth
  const [a, b] =
    where === 'tail'
      ? [keys[keys.length - 2], keys[keys.length - 1]]
      : [keys[0], keys[1]];
  // A zero anchor makes the ratio meaningless; hold flat rather than emit NaN.
  if (anchors[a] <= 0 || anchors[b] <= 0) return 1;
  return Math.pow(anchors[b] / anchors[a], 1 / (b - a));
}

/**
 * Expand sparse anchors into a dense level->value series.
 * Index 0 is unused so `series[n]` reads as "level n".
 */
export function series(
  maxLevel: number,
  anchors: Anchors,
  round: (n: number) => number,
): (SeriesEntry | null)[] {
  const keys = Object.keys(anchors).map(Number).sort((a, b) => a - b);
  if (keys.length === 0) throw new Error('series() needs at least one anchor');

  const out: (SeriesEntry | null)[] = new Array(maxLevel + 1).fill(null);

  for (let lvl = 1; lvl <= maxLevel; lvl++) {
    if (anchors[lvl] !== undefined) {
      out[lvl] = { value: anchors[lvl], est: false };
      continue;
    }

    const lo = [...keys].reverse().find((k) => k < lvl);
    const hi = keys.find((k) => k > lvl);

    let raw: number;
    if (lo !== undefined && hi !== undefined) {
      raw = interpolate(anchors[lo], anchors[hi], (lvl - lo) / (hi - lo));
    } else if (lo !== undefined) {
      // extrapolate past the last anchor using the trailing growth rate
      raw = anchors[lo] * Math.pow(growthRate(anchors, keys, 'tail'), lvl - lo);
    } else {
      // extrapolate below the first anchor using the leading growth rate
      raw = anchors[hi!] / Math.pow(growthRate(anchors, keys, 'head'), hi! - lvl);
    }

    out[lvl] = { value: round(raw), est: true };
  }

  return out;
}

export const costSeries = (maxLevel: number, anchors: Anchors) =>
  series(maxLevel, anchors, roundResource);

export const timeSeries = (maxLevel: number, anchors: Anchors) =>
  series(maxLevel, anchors, roundHours);

/** Build the dense per-level table a building or unit exposes. */
export function buildLevels(maxLevel: number, costs: Anchors, times: Anchors): (LevelStep | null)[] {
  if (maxLevel < 1) return [];
  const c = costSeries(maxLevel, costs);
  const t = timeSeries(maxLevel, times);
  const out: (LevelStep | null)[] = [null];
  for (let l = 1; l <= maxLevel; l++) {
    out.push({ level: l, cost: c[l]!.value, hours: t[l]!.value, est: c[l]!.est || t[l]!.est });
  }
  return out;
}
