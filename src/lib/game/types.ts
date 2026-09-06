import type { LevelStep } from './curve';

export type Resource = 'gold' | 'elixir' | 'dark';

export type BuildingCategory =
  | 'defense' | 'trap' | 'resource' | 'army' | 'wall' | 'other';

export type UnitKind = 'troop' | 'spell' | 'siege' | 'hero' | 'pet';

/** Where an upgrade queues: builders are a pool, lab and heroes are single lanes. */
export type Lane = 'builder' | 'lab' | 'hero';

export interface Building {
  id: string;
  name: string;
  category: BuildingCategory;
  /** Resource spent to upgrade it. */
  resource: Resource;
  /** Footprint in grid tiles, [width, height]. */
  size: readonly [number, number];
  /** How many exist at each Town Hall; index === TH level, 0 unused. */
  count: number[];
  /** Highest reachable level at each Town Hall; index === TH level. */
  max: number[];
  /** Highest level across all Town Halls. */
  maxLevel: number;
  /** First Town Hall at which it can be placed. */
  unlockTH: number;
  /** Dense per-level costs; index === level, 0 unused. */
  levels: (LevelStep | null)[];
}

export interface Unit {
  id: string;
  name: string;
  kind: UnitKind;
  resource: Resource;
  /** Army camp space consumed; 0 for heroes and pets. */
  housing: number;
  max: number[];
  maxLevel: number;
  unlockTH: number;
  levels: (LevelStep | null)[];
}

export interface TownHall {
  th: number;
  cost: number;
  hours: number;
  /** False when the cost/time is a curated estimate rather than a known value. */
  verified: boolean;
  hp: number;
  builders: number;
}

/** A single queued upgrade. */
export interface QueueItem {
  uid: string;
  kind: 'building' | 'unit';
  id: string;
  name: string;
  from: number;
  to: number;
  cost: number;
  hours: number;
  est: boolean;
  resource: Resource;
  lane: Lane;
}

/** A queue item once the scheduler has placed it on a lane. */
export interface ScheduledItem extends QueueItem {
  laneType: Lane;
  laneIndex: number;
  /** Hours from now. */
  start: number;
  end: number;
}
