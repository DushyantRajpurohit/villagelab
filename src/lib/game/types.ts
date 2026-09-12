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

/**
 * Sparky Stones — what temporary upgrades pay out.
 *
 * The odd one out, and kept out of `Resource` for the opposite reason to
 * `Ore`. Ores are a cost the app never totals with gold; Sparky Stones are not
 * a cost in the village at all. Nothing in either village is built or upgraded
 * with them. They are *earned* — 8 for every Crafted Defense module level and
 * 10 for every Supercharge charge level — and spent only in the Fancy Shop, on
 * cosmetics. So they are a yield, and the app models them as one: something an
 * upgrade pays you, never something an upgrade costs.
 *
 * They are held against a cap of 5,000 rather than in a storage, which is the
 * other reason they are not a `Resource`: no structure banks them, so there is
 * no storage art to mark a balance with.
 */
export type Sparky = 'sparky';

/**
 * Anything a cost can be denominated in — for the badge, not for a total.
 *
 * Sparky Stones are here because the Fancy Shop prices cosmetics in them, so
 * there is a figure to badge. Nothing in the village is priced in them.
 */
export type Currency = Resource | Ore | Sparky;

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

/**
 * One of a Crafted Defense's three modules.
 *
 * A module is the unit of upgrading, not the defense: the defense itself has no
 * cost table of its own. Each module runs 1..10, spends exactly one currency,
 * and the three modules of a defense spend three different ones — so a single
 * Crafted Defense is billed in gold *and* elixir *and* dark elixir. That is why
 * a module carries the `resource`, where a `Building` carries it once.
 *
 * Structurally a module is an `Upgradable` (see planner.ts): a ceiling per hall
 * and a dense level table is exactly what it is, which is why the planner's
 * engine can price one without knowing what a Crafted Defense is.
 */
export interface CraftedModule {
  /** 1, 2 or 3 — the order the game lists them in. */
  index: number;
  name: string;
  /** The one currency this module spends. */
  resource: Resource;
  /** Highest reachable level at each Town Hall; index === TH level. */
  max: number[];
  maxLevel: number;
  /**
   * Dense per-level costs; index === level, 0 unused. Level 1 is null: it is
   * the level the module arrives at, not an upgrade anyone buys.
   */
  levels: (LevelStep | null)[];
}

/**
 * A Crafted Defense — what the Crafting Station can be turned into.
 *
 * Not a `Building`, and the differences are the point:
 *
 *  - **It has no level ladder of its own.** Its level is the sum of its three
 *    modules' levels, so it arrives at 3 and tops out at 30, and there is no
 *    such thing as the cost of "level 7".
 *  - **It is billed in three currencies**, one per module.
 *  - **It is temporary.** A Crafting Phase lasts four months and takes its set
 *    with it when it ends. `CRAFTING_PHASE` says which set this is.
 *  - **It is free to choose and free to swap.** The station can be toggled
 *    between the phase's defenses at no cost, so a player can hold all three
 *    and pay only for the modules they upgrade.
 */
export interface CraftedDefense {
  id: string;
  name: string;
  /** Footprint in grid tiles, [width, height]. */
  size: readonly [number, number];
  /** First Town Hall at which the Crafting Station can be placed. */
  unlockTH: number;
  modules: CraftedModule[];
  /** The defense's own level at each Town Hall: its modules' ceilings summed. */
  max: number[];
  /** 30 — all three modules at 10. */
  maxLevel: number;
}

/**
 * Which Crafting Phase the dataset describes, and when it ends.
 *
 * Recorded rather than assumed because the set rotates: after `until` these
 * three defenses are gone from the game and the next three are not in here
 * yet. The app says which phase it is holding rather than presenting a
 * finished phase as current.
 */
export interface CraftingPhase {
  number: number;
  /** ISO dates, as published. */
  from: string;
  until: string;
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
