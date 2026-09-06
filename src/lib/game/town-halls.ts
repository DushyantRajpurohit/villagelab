import type { TownHall } from './types';

/**
 * Town Hall progression.
 *
 * `verified: true` means the cost/time is a value I'm confident is the real
 * in-game number. `verified: false` means it is a curated estimate — the UI
 * renders those with a "≈" so they are never mistaken for exact figures.
 * Correcting one is a one-line edit here.
 */
export const TOWN_HALLS: (TownHall | null)[] = [
  null, // index 0 unused; index === town hall level
  { th: 1,  cost: 0,          hours: 0,    verified: true,  hp: 450,  builders: 2 },
  { th: 2,  cost: 1_000,      hours: 0.02, verified: true,  hp: 1600, builders: 2 },
  { th: 3,  cost: 4_000,      hours: 0.05, verified: true,  hp: 1850, builders: 2 },
  { th: 4,  cost: 25_000,     hours: 2,    verified: true,  hp: 2100, builders: 3 },
  { th: 5,  cost: 150_000,    hours: 6,    verified: true,  hp: 2400, builders: 3 },
  { th: 6,  cost: 750_000,    hours: 24,   verified: true,  hp: 2800, builders: 4 },
  { th: 7,  cost: 1_200_000,  hours: 48,   verified: true,  hp: 3200, builders: 5 },
  { th: 8,  cost: 2_000_000,  hours: 96,   verified: true,  hp: 3700, builders: 5 },
  { th: 9,  cost: 3_000_000,  hours: 144,  verified: true,  hp: 4200, builders: 5 },
  { th: 10, cost: 4_000_000,  hours: 192,  verified: true,  hp: 4900, builders: 5 },
  { th: 11, cost: 6_000_000,  hours: 240,  verified: true,  hp: 5500, builders: 5 },
  { th: 12, cost: 7_000_000,  hours: 288,  verified: false, hp: 6800, builders: 6 },
  { th: 13, cost: 8_000_000,  hours: 336,  verified: false, hp: 8200, builders: 6 },
  { th: 14, cost: 11_000_000, hours: 384,  verified: false, hp: 9400, builders: 6 },
  { th: 15, cost: 13_000_000, hours: 432,  verified: false, hp: 10000, builders: 6 },
  { th: 16, cost: 15_000_000, hours: 480,  verified: false, hp: 10500, builders: 6 },
  { th: 17, cost: 20_000_000, hours: 528,  verified: false, hp: 11000, builders: 6 },
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
