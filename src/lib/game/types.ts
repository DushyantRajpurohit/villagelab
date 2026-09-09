import type { LevelStep } from './curve';

/**
 * The two villages an account has.
 *
 * Defined here rather than in the store or the sprite index because almost
 * everything is now keyed by it — state, layouts, palettes, art — and those
 * modules should not have to import each other to agree on the word.
 */
export type VillageId = 'home' | 'builder';

export type Resource = 'gold' | 'elixir' | 'dark';

/**
 * The three ores hero equipment is upgraded with.
 *
 * Kept out of `Resource` deliberately, the same way `BuilderResource` is. Ores
 * are not village currency: nothing else in either village costs them, no
 * storage banks them, they cannot be raided or donated, and a single equipment
 * upgrade spends two or three of them at once — which is the shape `Resource`
 * cannot describe, since every building and unit step spends exactly one.
 * Folding them in would put three keys into every `Record<Resource, number>`
 * total that can never receive a value.
 */
export type Ore = 'shiny' | 'glowy' | 'starry';

/** Anything a cost can be denominated in — for the badge, not for a total. */
export type Currency = Resource | Ore;

/** What an equipment upgrade costs. Ores an item never uses are absent. */
export type OreCost = Partial<Record<Ore, number>>;

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

/**
 * A piece of hero equipment.
 *
 * Equipment is a third kind of entity: not a structure, not a unit. It is
 * bought or found rather than built, upgraded in the Blacksmith with ores
 * rather than in the Laboratory with elixir, and its upgrades are instant —
 * there is no build time and it occupies no lane, so it never enters the
 * planner's queue.
 *
 * `max` is a ceiling, not a claim of ownership: it says how far this item
 * *could* go at a hall if the account has it. Common equipment comes with its
 * hero; epic equipment is bought from events, the Trader or the League Shop,
 * and the game publishes no Town Hall requirement for that.
 */
export interface Equipment {
  id: string;
  name: string;
  /** The hero that carries it — a `Unit` id. */
  hero: string;
  rarity: 'common' | 'epic';
  /** Active equipment is triggered with the hero's ability; passive is always on. */
  ability: 'active' | 'passive';
  /** Highest reachable level at each Town Hall; index === TH level. */
  max: number[];
  maxLevel: number;
  unlockTH: number;
  /** Dense per-level costs; index === level, 0 unused. Level 1 costs nothing. */
  levels: (EquipmentStep | null)[];
}

export interface EquipmentStep {
  level: number;
  ore: OreCost;
  /** Blacksmith level this upgrade needs. */
  gate: number;
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
