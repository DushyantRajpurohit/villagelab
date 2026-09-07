import type { TownHall } from './types';

/**
 * Town Hall progression.
 *
 * `verified: true` means the cost/time is a value I'm confident is the real
 * in-game number. `verified: false` means it is a curated estimate — the UI
 * renders those with a "≈" so they are never mistaken for exact figures.
 * Correcting one is a one-line edit here.
 *
 * Every level is now a published figure, transcribed from the game's own Town
 * Hall table rather than interpolated, so nothing here is an estimate any more.
 * That corrected the upper halls substantially: the old curated guesses had
 * TH17 at 528 hours and 20M gold against a real 240 hours and 16M, because a
 * geometric guess kept doubling where the game had flattened out.
 */
export const TOWN_HALLS: (TownHall | null)[] = [
  null, // index 0 unused; index === town hall level
  { th: 1, cost: 0, hours: 0, verified: true, hp: 400, builders: 2 },
  { th: 2, cost: 1_000, hours: 0.00277778, verified: true, hp: 800, builders: 2 },
  { th: 3, cost: 4_000, hours: 0.5, verified: true, hp: 1600, builders: 2 },
  { th: 4, cost: 25_000, hours: 3, verified: true, hp: 2000, builders: 3 },
  { th: 5, cost: 150_000, hours: 6, verified: true, hp: 2400, builders: 3 },
  { th: 6, cost: 500_000, hours: 12, verified: true, hp: 2800, builders: 4 },
  { th: 7, cost: 1_000_000, hours: 18, verified: true, hp: 3300, builders: 5 },
  { th: 8, cost: 2_000_000, hours: 24, verified: true, hp: 3900, builders: 5 },
  { th: 9, cost: 2_500_000, hours: 48, verified: true, hp: 4600, builders: 5 },
  { th: 10, cost: 3_500_000, hours: 72, verified: true, hp: 5500, builders: 5 },
  { th: 11, cost: 4_000_000, hours: 120, verified: true, hp: 6800, builders: 5 },
  { th: 12, cost: 6_000_000, hours: 144, verified: true, hp: 7500, builders: 6 },
  { th: 13, cost: 9_000_000, hours: 168, verified: true, hp: 8200, builders: 6 },
  { th: 14, cost: 12_000_000, hours: 180, verified: true, hp: 8900, builders: 6 },
  { th: 15, cost: 13_000_000, hours: 192, verified: true, hp: 9600, builders: 6 },
  { th: 16, cost: 15_000_000, hours: 216, verified: true, hp: 10000, builders: 6 },
  { th: 17, cost: 16_000_000, hours: 240, verified: true, hp: 10400, builders: 6 },
  { th: 18, cost: 25_000_000, hours: 288, verified: true, hp: 10800, builders: 6 },
];

export const MAX_TH = TOWN_HALLS.length - 1;

/** The village grid is 44x44 at every Town Hall. */
export const GRID = 44;

/**
 * Builders available at a given TH. Players can also buy a sixth builder and
 * the O.T.T.O hut, so this is the *typical* ceiling, not a hard cap — the
 * planner lets you override it.
 */
export function defaultBuilders(th: number): number {
  return TOWN_HALLS[th]?.builders ?? 5;
}
