import type { LevelStep } from './curve';
import { BUILDINGS_BY_ID, byTH } from './buildings';
import { MAX_TH } from './town-halls';
import type { Resource, Unit, UnitKind } from './types';

/**
 * Troops, spells, siege machines, heroes and pets.
 *
 * Every number is read from that unit's own published table: per-level upgrade
 * cost, upgrade time, and the level of the building that gates it. Nothing is
 * interpolated, so `est` is `false` throughout and the "≈" no longer appears
 * anywhere in the app.
 *
 * This replaced sparse anchors plus a geometric curve, and the correction was
 * not small. 46 of the 67 units had the wrong maximum level — the Witch was
 * listed at 10 against a real 8, the Healer at 9 against a real 11 — and
 * cost-to-max ran from 65% under (the Goblin) to 158% over (the Lava Hound).
 * Elixir troops were consistently understated and dark ones overstated, which
 * is exactly what a single shared curve does to two different price scales.
 *
 * A unit's table never names a Town Hall. It names the building that gates the
 * upgrade — the Laboratory for troops and spells, the Pet House for pets, the
 * Hero Hall for heroes — so the ceiling at a hall is derived by asking when
 * that building first reaches the required level. Those building ceilings are
 * themselves transcribed, which makes this a lookup rather than a guess.
 *
 * Level 1 needs a different source, and getting that wrong is the mistake this
 * comment exists to prevent: the level table's first row is free and carries no
 * Laboratory requirement, so reading the unlock from it put the Dragon at Town
 * Hall 1. The unlock comes from the *producing* building instead — Barracks,
 * Dark Barracks, Spell Factory, Dark Spell Factory, Workshop, Pet House — named
 * on each page's info table.
 *
 * @see home-units.json for the data and the page each entry came from.
 */

import data from './home-units.json';

interface RawLevel {
  cost: number;
  hours: number;
}

interface RawUnit {
  name: string;
  kind: string;
  resource: string;
  housing: number;
  max: Record<string, number>;
  levels: RawLevel[];
  /** The building whose level gates each upgrade. */
  gate: string;
  page: string;
}

const numeric = (spec: Record<string, number>): Record<number, number> =>
  Object.fromEntries(Object.entries(spec).map(([k, v]) => [Number(k), v]));

/** Index 0 is unused so `levels[level]` reads naturally. */
const steps = (levels: RawLevel[]): (LevelStep | null)[] => [
  null,
  ...levels.map((l, i) => ({ level: i + 1, cost: l.cost, hours: l.hours, est: false })),
];

function build(id: string, raw: RawUnit): Unit {
  const max = byTH(numeric(raw.max));
  return {
    id,
    name: raw.name,
    kind: raw.kind as UnitKind,
    resource: raw.resource as Resource,
    housing: raw.housing,
    max,
    maxLevel: raw.levels.length,
    unlockTH: max.findIndex((v) => v > 0),
    levels: steps(raw.levels),
  };
}

const RAW = data as unknown as Record<string, RawUnit>;

const ALL: Unit[] = Object.entries(RAW).map(([id, raw]) => build(id, raw));
const of = (pick: (u: Unit, raw: RawUnit) => boolean) =>
  ALL.filter((u) => pick(u, RAW[u.id]));

/** Elixir troops (Barracks + Laboratory). */
export const TROOPS: Unit[] = of((u) => u.kind === 'troop' && u.resource === 'elixir');

/** Dark Elixir troops (Dark Barracks + Laboratory). */
export const DARK_TROOPS: Unit[] = of((u) => u.kind === 'troop' && u.resource === 'dark');

/** Elixir + Dark spells (Spell Factory / Dark Spell Factory + Laboratory). */
export const SPELLS: Unit[] = of((u) => u.kind === 'spell');

/** Siege machines (Workshop + Laboratory). */
export const SIEGES: Unit[] = of((u) => u.kind === 'siege');

/**
 * Heroes (Hero Hall — upgraded outside the Laboratory, one at a time).
 *
 * The Hero Hall's own levels do not track the Town Hall one for one, which is
 * the trap in deriving these by hand: Hero Hall 1 arrives at Town Hall 4 and
 * Hero Hall 2 not until Town Hall 8.
 */
export const HEROES: Unit[] = of((u) => u.kind === 'hero');

/** Hero pets (Pet House). */
export const PETS: Unit[] = of((u) => u.kind === 'pet');

export const ALL_UNITS: Unit[] = ALL;

export const UNITS_BY_ID: Record<string, Unit> =
  Object.fromEntries(ALL_UNITS.map((u) => [u.id, u]));

/** Everything unlocked at a Town Hall, with the max level reachable there. */
export function unitsAtTH(th: number) {
  return ALL_UNITS.filter((u) => u.max[th] > 0).map((u) => ({ ...u, maxHere: u.max[th] }));
}

/** The page each unit's numbers were read from, for provenance. */
export const UNIT_SOURCE: Record<string, string> = Object.fromEntries(
  Object.entries(RAW).map(([id, raw]) => [id, raw.page]),
);

/**
 * Army and spell capacity, per Town Hall.
 *
 * Derived rather than transcribed, from each storage building's own capacity
 * curve times how many of it the hall allows. That is what keeps them in step
 * with the building table — the hand-written arrays these replaced stopped at
 * Town Hall 17, and the spell one was a whole hall out of phase from Town Hall
 * 6 upward.
 */
const capacityByTH = (buildingId: string, perLevel: number[]): number[] => {
  const b = BUILDINGS_BY_ID[buildingId];
  const out = new Array(MAX_TH + 1).fill(0);
  for (let th = 1; th <= MAX_TH; th++) {
    const level = b.max[th];
    if (level > 0) out[th] = b.count[th] * (perLevel[level] ?? 0);
  }
  return out;
};

/** Troop capacity of one Army Camp, indexed by its level. */
const CAMP_PER_LEVEL = [0, 20, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 88];
/** Spell slots in one Spell Factory, indexed by its level. */
const SPELL_PER_LEVEL = [0, 2, 4, 6, 8, 10, 10, 10, 10, 10];
/** A Dark Spell Factory holds one dark spell at every level. */
const DARK_SPELL_PER_LEVEL = [0, 1, 1, 1, 1, 1, 1, 1, 1];

export const CAMP_CAPACITY: number[] = capacityByTH('army_camp', CAMP_PER_LEVEL);

export const SPELL_CAPACITY: number[] = capacityByTH('spell_factory', SPELL_PER_LEVEL)
  .map((n, th) => n + capacityByTH('dark_spell_factory', DARK_SPELL_PER_LEVEL)[th]);
