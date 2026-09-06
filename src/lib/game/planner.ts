import type { Building, Lane, QueueItem, ScheduledItem, Unit } from './types';

/* ==========================================================================
   Village state is stored as *level buckets* — { 14: 3, 15: 4 } means three
   structures at level 14 and four at 15. That scales to 325 walls as easily as
   to 2 Inferno Towers, and makes "upgrade the weakest one" trivial.
   ========================================================================== */

export type Buckets = Record<number, number>;

export const sumBuckets = (b: Buckets): number =>
  Object.values(b).reduce((a, n) => a + n, 0);

/** Lowest-level instance — the one an "upgrade next" action targets. */
export function weakest(buckets: Buckets): number | null {
  const levels = Object.keys(buckets)
    .map(Number)
    .filter((l) => buckets[l] > 0)
    .sort((a, b) => a - b);
  return levels[0] ?? null;
}

/**
 * Keep bucket totals equal to the structure count, filling at the lowest level
 * and trimming from the highest. Bucket state comes from user input, so it can
 * drift out of sync with the Town Hall's building count at any time.
 */
export function rebalance(buckets: Buckets, count: number): Buckets {
  const out = { ...buckets };
  let have = sumBuckets(out);
  if (have < count) {
    const lowest = Object.keys(out).map(Number).sort((a, b) => a - b)[0] ?? 1;
    out[lowest] = (out[lowest] || 0) + (count - have);
  } else {
    for (const l of Object.keys(out).map(Number).sort((a, b) => b - a)) {
      if (have <= count) break;
      const take = Math.min(out[l], have - count);
      out[l] -= take;
      have -= take;
      if (!out[l]) delete out[l];
    }
  }
  return out;
}

/** Buckets for a building at a Town Hall, defaulting to the previous TH ceiling. */
export function bucketsFor(
  saved: Buckets | undefined,
  b: Building,
  th: number,
): Buckets {
  const count = b.count[th];
  if (saved && sumBuckets(saved) === count) return { ...saved };
  const baseline = Math.max(1, Math.min(b.max[th], th > 1 ? b.max[th - 1] || 1 : 1));
  if (saved) return rebalance(saved, count);
  return { [baseline]: count };
}

export interface Remaining {
  cost: number;
  hours: number;
  est: boolean;
  /** How many instances are still below the Town Hall cap. */
  pending: number;
  cap: number;
}

export function buildingRemaining(b: Building, buckets: Buckets, th: number): Remaining {
  const cap = b.max[th];
  let cost = 0, hours = 0, est = false, pending = 0;
  for (const [lvlStr, n] of Object.entries(buckets)) {
    const lvl = Number(lvlStr);
    for (let l = lvl + 1; l <= cap; l++) {
      const step = b.levels[l];
      if (!step) continue;
      cost += step.cost * n;
      hours += step.hours * n;
      est ||= step.est;
    }
    if (lvl < cap) pending += n;
  }
  return { cost, hours, est, pending, cap };
}

export function unitRemaining(u: Unit, level: number, th: number): Remaining {
  const cap = u.max[th];
  let cost = 0, hours = 0, est = false;
  for (let l = level + 1; l <= cap; l++) {
    const step = u.levels[l];
    if (!step) continue;
    cost += step.cost;
    hours += step.hours;
    est ||= step.est;
  }
  return { cost, hours, est, cap, pending: level < cap ? 1 : 0 };
}

export interface Schedule {
  items: ScheduledItem[];
  /** Hours until the whole queue is done. */
  finishHours: number;
  lanes: Record<Lane, number[]>;
}

/**
 * Greedy multi-lane schedule.
 *
 * Buildings compete for N builders; laboratory research is one sequential lane;
 * hero upgrades are their own lane (the Hero Hall does not consume a builder in
 * current versions of the game). Items are placed in queue order into whichever
 * lane of the right type frees up first.
 */
export function schedule(queue: QueueItem[], builders: number): Schedule {
  const lanes: Record<Lane, number[]> = {
    builder: Array.from({ length: Math.max(1, builders) }, () => 0),
    lab: [0],
    hero: [0],
  };

  const items = queue.map<ScheduledItem>((q) => {
    const laneType: Lane = q.lane || 'builder';
    const pool = lanes[laneType] ?? lanes.builder;
    let idx = 0;
    for (let i = 1; i < pool.length; i++) if (pool[i] < pool[idx]) idx = i;
    const start = pool[idx];
    const end = start + (q.hours || 0);
    pool[idx] = end;
    return { ...q, laneType, laneIndex: idx, start, end };
  });

  const finishHours = Math.max(0, ...Object.values(lanes).flat());
  return { items, finishHours, lanes };
}
