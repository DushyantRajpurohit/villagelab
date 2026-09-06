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

/** Round to a sensible resource granularity so estimates don't look fake-precise. */
function roundResource(v) {
  if (v < 1000) return Math.round(v / 10) * 10;
  if (v < 100000) return Math.round(v / 1000) * 1000;
  if (v < 1000000) return Math.round(v / 10000) * 10000;
  return Math.round(v / 100000) * 100000;
}

/** Round hours to a granularity the game actually uses. */
function roundHours(h) {
  if (h < 1) return Math.round(h * 60) / 60;      // minutes
  if (h < 24) return Math.round(h * 2) / 2;        // half hours
  if (h < 24 * 7) return Math.round(h);            // hours
  return Math.round(h / 12) * 12;                  // half days
}

/**
 * Expand sparse anchors into a dense level->value series.
 *
 * @param {number} maxLevel  highest level to generate
 * @param {Record<number, number>} anchors  level -> known value
 * @param {(n:number)=>number} round
 * @returns {{value:number, est:boolean}[]} index 0 unused, index n = level n
 */
export function series(maxLevel, anchors, round) {
  const keys = Object.keys(anchors)
    .map(Number)
    .sort((a, b) => a - b);

  if (keys.length === 0) throw new Error('series() needs at least one anchor');

  const out = new Array(maxLevel + 1).fill(null);

  for (let lvl = 1; lvl <= maxLevel; lvl++) {
    if (anchors[lvl] !== undefined) {
      out[lvl] = { value: anchors[lvl], est: false };
      continue;
    }

    const lo = [...keys].reverse().find((k) => k < lvl);
    const hi = keys.find((k) => k > lvl);

    let raw;
    if (lo !== undefined && hi !== undefined) {
      // geometric interpolation between two known anchors
      const span = hi - lo;
      const ratio = Math.pow(anchors[hi] / anchors[lo], 1 / span);
      raw = anchors[lo] * Math.pow(ratio, lvl - lo);
    } else if (lo !== undefined) {
      // extrapolate past the last anchor using the trailing growth rate
      const ratio = growthRate(anchors, keys, 'tail');
      raw = anchors[lo] * Math.pow(ratio, lvl - lo);
    } else {
      // extrapolate below the first anchor using the leading growth rate
      const ratio = growthRate(anchors, keys, 'head');
      raw = anchors[hi] / Math.pow(ratio, hi - lvl);
    }

    out[lvl] = { value: round(raw), est: true };
  }

  return out;
}

/** Average per-level multiplier at the head or tail of the anchor set. */
function growthRate(anchors, keys, where) {
  if (keys.length < 2) return 1.5; // lone anchor: assume typical CoC growth
  const [a, b] =
    where === 'tail'
      ? [keys[keys.length - 2], keys[keys.length - 1]]
      : [keys[0], keys[1]];
  return Math.pow(anchors[b] / anchors[a], 1 / (b - a));
}

export const costSeries = (maxLevel, anchors) => series(maxLevel, anchors, roundResource);
export const timeSeries = (maxLevel, anchors) => series(maxLevel, anchors, roundHours);

/** Format hours the way the game does: 12d 6h, 3h 30m, 45m */
export function fmtDuration(hours) {
  if (hours == null) return '—';
  const total = Math.round(hours * 60);
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m && !d) parts.push(`${m}m`);
  return parts.join(' ') || '0m';
}

/** Format resources: 12.5M, 840k, 900 */
export function fmtResource(v) {
  if (v == null) return '—';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(v));
}
