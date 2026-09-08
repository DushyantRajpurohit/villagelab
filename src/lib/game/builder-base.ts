import type { LevelStep } from './curve';

/**
 * Builder Base — the second village.
 *
 * Every number here is read from the game's published tables: per-level build
 * and research costs, build times, footprints, how many of each structure a
 * Builder Hall allows and how far each can be upgraded there. Nothing is
 * interpolated.
 *
 * `buildings.ts` now works the same way, from the same kind of source: this
 * file was the proof that a per-structure scrape beats a curve, and the Home
 * Village's buildings were rebuilt on it afterwards. `est` is `false` on every
 * step in both, and the "≈" survives only on `army.ts` — troops, spells and
 * heroes are still anchored-and-interpolated.
 *
 * Ceilings are derived rather than transcribed: a troop's ceiling at a Builder
 * Hall is the highest level whose published Star Laboratory requirement that
 * hall can meet, and the Star Laboratory's own level equals the Builder Hall's.
 * The two independent tables agree — a structure's highest priced level is
 * exactly its ceiling at Builder Hall 10 — which is what makes the derivation
 * trustworthy rather than a guess.
 *
 * One Builder Base rule has no Home Village equivalent: a troop or structure
 * that unlocks late **arrives part-levelled**. The Electrofire Wizard opens at
 * Builder Hall 10 already at level 17, and its first research is to 18. That is
 * `startLevel`, and every level at or below it is `null` here rather than a
 * zero-cost step — a phantom step would be summed as a free upgrade and would
 * report a freshly unlocked troop as 0% done when the game considers it 85%.
 *
 * @see builder-base.json for the data and the page each entry came from.
 */

import data from './builder-base.json';

/** Builder Hall tops out at 10. */
export const MAX_BH = 10;

/**
 * The Builder Base has its own currencies.
 *
 * Builder Gold and Builder Elixir are not the Home Village's gold and elixir:
 * they are earned separately, stored separately and cannot be moved between
 * villages. They share these names because the game does. Keeping the two
 * villages' totals apart is the job of the planner's per-village state, not of
 * this type.
 */
export type BuilderResource = 'gold' | 'elixir';

export type BuilderUnitKind = 'troop' | 'hero';

export type BuilderBuildingCategory = 'defense' | 'trap' | 'wall' | 'resource' | 'army';

export interface BuilderUnit {
  id: string;
  name: string;
  kind: BuilderUnitKind;
  resource: BuilderResource;
  /** Max level per Builder Hall, indexed by BH. Index 0 is unused. */
  max: number[];
  maxLevel: number;
  unlockBH: number;
  /** The level it arrives at when unlocked; levels at or below it are null. */
  startLevel: number;
  /** Dense per-level costs; index === level, 0 unused. */
  levels: (LevelStep | null)[];
}

export interface BuilderBuilding {
  id: string;
  name: string;
  category: BuilderBuildingCategory;
  resource: BuilderResource;
  /** Footprint in grid tiles, [width, height]. */
  size: readonly [number, number];
  /** How many exist at each Builder Hall; index === BH, 0 unused. */
  count: number[];
  max: number[];
  maxLevel: number;
  unlockBH: number;
  /** The level it is placed at; levels at or below it are null. */
  startLevel: number;
  levels: (LevelStep | null)[];
}

interface RawLevel { cost: number; hours: number }
interface RawBuilding {
  name: string; category: string; resource: string;
  size: number[]; count: number[]; max: number[];
  levels: (RawLevel | null)[]; startLevel: number; page: string;
}
interface RawUnit {
  name: string; kind: string; resource: string;
  max: number[]; levels: (RawLevel | null)[]; startLevel: number;
  unlockBH: number; page: string;
}

/**
 * Raw levels to the same dense, 1-indexed shape the Home Village uses, so the
 * planner and the progress views can treat a Builder Base upgrade exactly like
 * a Home Village one. `est` is always false — see the note at the top.
 */
const steps = (levels: (RawLevel | null)[]): (LevelStep | null)[] => [
  null,
  ...levels.map((l, i) => (l ? { level: i + 1, cost: l.cost, hours: l.hours, est: false } : null)),
];

const RAW = data as unknown as {
  buildings: Record<string, RawBuilding>;
  units: Record<string, RawUnit>;
};

export const BUILDER_BUILDINGS: BuilderBuilding[] = Object.entries(RAW.buildings)
  .map(([id, b]) => ({
    id,
    name: b.name,
    category: b.category as BuilderBuildingCategory,
    resource: b.resource as BuilderResource,
    size: [b.size[0], b.size[1]] as const,
    count: b.count,
    max: b.max,
    maxLevel: Math.max(...b.max),
    unlockBH: b.count.findIndex((c) => c > 0),
    startLevel: b.startLevel,
    levels: steps(b.levels),
  }))
  .sort((a, b) => a.unlockBH - b.unlockBH || a.name.localeCompare(b.name));

const UNITS: BuilderUnit[] = Object.entries(RAW.units).map(([id, u]) => ({
  id,
  name: u.name,
  kind: u.kind as BuilderUnitKind,
  resource: u.resource as BuilderResource,
  max: u.max,
  maxLevel: Math.max(...u.max),
  unlockBH: u.unlockBH,
  startLevel: u.startLevel,
  levels: steps(u.levels),
}));

const byUnlock = (a: BuilderUnit, b: BuilderUnit) => a.unlockBH - b.unlockBH || a.name.localeCompare(b.name);

export const BUILDER_TROOPS: BuilderUnit[] = UNITS.filter((u) => u.kind === 'troop').sort(byUnlock);
export const BUILDER_HEROES: BuilderUnit[] = UNITS.filter((u) => u.kind === 'hero').sort(byUnlock);
export const BUILDER_UNITS: BuilderUnit[] = [...BUILDER_TROOPS, ...BUILDER_HEROES];

export const BUILDER_UNITS_BY_ID: Record<string, BuilderUnit> =
  Object.fromEntries(BUILDER_UNITS.map((u) => [u.id, u]));

export const BUILDER_BUILDINGS_BY_ID: Record<string, BuilderBuilding> =
  Object.fromEntries(BUILDER_BUILDINGS.map((b) => [b.id, b]));

/** Every unit unlocked at a given Builder Hall, with its ceiling there. */
export function builderUnitsAtBH(bh: number) {
  return BUILDER_UNITS.filter((u) => u.max[bh] > 0).map((u) => ({ ...u, maxHere: u.max[bh] }));
}

/** Every structure placeable at a given Builder Hall, with its count and ceiling there. */
export function builderBuildingsAtBH(bh: number) {
  return BUILDER_BUILDINGS.filter((b) => b.count[bh] > 0).map((b) => ({
    ...b,
    countHere: b.count[bh],
    maxHere: b.max[bh],
  }));
}

/**
 * The Builder Hall's own cost to reach a level, or null for level 1 — you are
 * given the first one, ruined, when the boat is repaired.
 */
export function builderHallStep(bh: number): LevelStep | null {
  const hall = RAW.buildings['builder_hall'];
  if (!hall) return null;
  const l = hall.levels[bh - 1];
  return l && l.cost ? { level: bh, cost: l.cost, hours: l.hours, est: false } : null;
}

/**
 * The level a unit sits at for a player who has just unlocked it and done no
 * research — its arrival level, not zero.
 */
export const builderStartLevel = (id: string): number =>
  BUILDER_UNITS_BY_ID[id]?.startLevel ?? 1;
