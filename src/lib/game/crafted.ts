import { byTH } from './buildings';
import { MAX_TH } from './town-halls';
import type { LevelStep } from './curve';
import type {
  CraftedDefense, CraftedModule, CraftingPhase, Resource,
} from './types';
import data from './crafted-defenses.json';

/**
 * Crafted Defenses — what the Crafting Station can be turned into.
 *
 * Every cost, build time and Town Hall requirement is transcribed from the
 * defense's own published module tables, the same route the buildings, units
 * and equipment datasets take. Nothing is interpolated.
 *
 * Four things about a Crafted Defense do not fit the `Building` mould, and each
 * is modelled rather than flattened away:
 *
 *  - **The module is the thing that upgrades, not the defense.** A defense has
 *    no cost table of its own. It has three modules of ten levels each; its
 *    own level is their sum, so it arrives at 3 and tops out at 30. There is no
 *    "cost of level 7", which is why nothing here returns one.
 *  - **One defense is billed in three currencies.** Each module spends exactly
 *    one, and the three modules spend three different ones — the Hot Candle's
 *    hitpoints are elixir, its damage gold, its seconds active dark elixir. So
 *    `resource` sits on the module where a `Building` carries it once, and a
 *    cost-to-max is a `Record<Resource, number>` rather than a figure.
 *  - **They are temporary.** See `CRAFTING_PHASE`.
 *  - **Choosing and swapping is free.** The station toggles between the
 *    phase's three defenses at no cost and they may be swapped at any time, so
 *    the bill is only for the modules actually upgraded — which is why
 *    `craftedCostToMax` prices one defense and `phaseCostToMax` prices all
 *    three separately, rather than one standing in for the other.
 *
 * They do take a builder and they do take build time, which is what separates
 * them from hero equipment: equipment is instant and occupies no lane, a module
 * occupies the builder lane for as long as a Town Hall does.
 *
 * @see crafted-defenses.json for the data and the page each entry came from.
 */

interface RawLevel {
  cost?: number;
  hours?: number;
  /** Town Hall level this module level requires. */
  th: number;
}

interface RawModule {
  name: string;
  resource: string;
  levels: RawLevel[];
}

interface RawDefense {
  name: string;
  page: string;
  size: number[];
  modules: RawModule[];
}

interface Raw {
  phase: CraftingPhase & { page: string };
  sparky: { perModuleLevel: number; perChargeLevel: number; cap: number; page: string };
  station: string;
  defenses: Record<string, RawDefense>;
}

const RAW = data as unknown as Raw;

/**
 * Which Crafting Phase this dataset holds, and when it ends.
 *
 * Crafted Defenses are the only content in the app with an expiry date. A phase
 * runs four months and its three defenses are removed when it ends; the next
 * three are different. So the dataset carries the current phase only — a
 * defense nobody can still craft is not something to plan against — and records
 * which one it is, so a dataset left behind by a rotation is visible in the UI
 * rather than silently presenting a finished set as current.
 *
 * Deliberately not asserted against the clock in a test: a test that starts
 * failing on a date nobody touched the code is a time bomb, not a check. The
 * UI reads the date and says what it finds.
 */
export const CRAFTING_PHASE: CraftingPhase = {
  number: RAW.phase.number,
  from: RAW.phase.from,
  until: RAW.phase.until,
};

/** True once the phase these defenses belong to has ended. */
export const phaseHasEnded = (now: Date = new Date()): boolean =>
  now > new Date(`${CRAFTING_PHASE.until}T23:59:59Z`);

/** The structure that hosts them — a real `Building`, free and level-less. */
export const CRAFTING_STATION_ID = RAW.station;

/* ----------------------------------------------------------------- build */

/** Index 0 is unused so `levels[level]` reads naturally. */
function steps(levels: RawLevel[]): (LevelStep | null)[] {
  return [
    null,
    // Level 1 is the level the module arrives at, not an upgrade anyone buys,
    // so it is null rather than a zero-cost step — the same rule
    // builder-base.json uses for a troop that unlocks part-levelled. Writing it
    // as { cost: 0 } would put a free row in every cost table that renders one.
    ...levels.map((l, i) =>
      l.cost === undefined || l.hours === undefined
        ? null
        : { level: i + 1, cost: l.cost, hours: l.hours, est: false }),
  ];
}

/**
 * A module's ceiling at each Town Hall: the highest level whose published Town
 * Hall requirement that hall meets. Derived rather than transcribed, exactly as
 * a structure's is.
 */
function ceilings(levels: RawLevel[]): number[] {
  const spec: Record<number, number> = {};
  for (const [i, l] of levels.entries()) {
    const level = i + 1;
    if (spec[l.th] === undefined || level > spec[l.th]) spec[l.th] = level;
  }
  return byTH(spec);
}

function buildModule(index: number, raw: RawModule): CraftedModule {
  return {
    index,
    name: raw.name,
    resource: raw.resource as Resource,
    max: ceilings(raw.levels),
    maxLevel: raw.levels.length,
    levels: steps(raw.levels),
  };
}

function buildDefense(id: string, raw: RawDefense): CraftedDefense {
  const modules = raw.modules.map((m, i) => buildModule(i + 1, m));
  // The defense's own level is its modules' levels summed, so its ceiling at a
  // hall is their ceilings summed — 3 where every module is at 1, 30 at TH18.
  const max = Array.from({ length: MAX_TH + 1 }, (_, th) =>
    modules.reduce((a, m) => a + m.max[th], 0));
  return {
    id,
    name: raw.name,
    size: [raw.size[0], raw.size[1]] as const,
    unlockTH: max.findIndex((v) => v > 0),
    modules,
    max,
    maxLevel: modules.reduce((a, m) => a + m.maxLevel, 0),
  };
}

export const CRAFTED_DEFENSES: CraftedDefense[] =
  Object.entries(RAW.defenses).map(([id, raw]) => buildDefense(id, raw));

export const CRAFTED_BY_ID: Record<string, CraftedDefense> =
  Object.fromEntries(CRAFTED_DEFENSES.map((d) => [d.id, d]));

/** The page each defense's numbers were read from, for provenance. */
export const CRAFTED_SOURCE: Record<string, string> =
  Object.fromEntries(Object.entries(RAW.defenses).map(([id, raw]) => [id, raw.page]));

/* ------------------------------------------------------------------ costs */

/** Every defense this hall can craft, with its ceiling there. */
export function craftedAtTH(th: number) {
  return CRAFTED_DEFENSES
    .filter((d) => d.max[th] > 0)
    .map((d) => ({ ...d, maxHere: d.max[th] }));
}

const zero = (): Record<Resource, number> => ({ gold: 0, elixir: 0, dark: 0 });

export interface CraftedCost {
  /** One figure per currency; a defense spends all three. */
  cost: Record<Resource, number>;
  hours: number;
  /** Module levels bought — what the Sparky Stone yield is counted from. */
  levels: number;
}

export const addCost = (...parts: CraftedCost[]): CraftedCost => {
  const out: CraftedCost = { cost: zero(), hours: 0, levels: 0 };
  for (const p of parts) {
    for (const k of ['gold', 'elixir', 'dark'] as Resource[]) out.cost[k] += p.cost[k];
    out.hours += p.hours;
    out.levels += p.levels;
  }
  return out;
};

/** What taking one module from `level` to its ceiling at this hall costs. */
export function moduleCostToMax(m: CraftedModule, level: number, th: number): CraftedCost {
  const out: CraftedCost = { cost: zero(), hours: 0, levels: 0 };
  for (let l = level + 1; l <= m.max[th]; l++) {
    const step = m.levels[l];
    if (!step) continue;
    out.cost[m.resource] += step.cost;
    out.hours += step.hours;
    out.levels += 1;
  }
  return out;
}

/**
 * What taking one whole defense to its ceiling costs, from scratch.
 *
 * Three currencies and one build time. The time is the sum of the three
 * modules' build times because only one module of a given Crafted Defense may
 * be upgraded at a time — so a defense is a single 67-day lane rather than
 * three that run in parallel.
 */
export const craftedCostToMax = (d: CraftedDefense, th: number): CraftedCost =>
  addCost(...d.modules.map((m) => moduleCostToMax(m, 1, th)));

/**
 * What maxing every defense in the phase costs.
 *
 * Worth stating separately because the station holds one defense at a time:
 * this is the bill for all three, which a player only faces if they intend to
 * swap between them. Different Crafted Defenses *can* be upgraded in parallel,
 * so the hours here are not a wall-clock estimate for one builder.
 */
export const phaseCostToMax = (th: number): CraftedCost =>
  addCost(...craftedAtTH(th).map((d) => craftedCostToMax(d, th)));
