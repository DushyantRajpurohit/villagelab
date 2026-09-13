import type { LevelStep } from './curve';
import { MAX_TH } from './town-halls';
import type { Building, BuildingCategory, Resource } from './types';

/**
 * Home Village structures.
 *
 * Every number here is read from the game's published per-level tables: build
 * costs, build times, how many of each structure a Town Hall allows, and how
 * far each one upgrades there. Nothing is interpolated, so `est` is `false` on
 * every step and the "≈" never appears on a Home Village figure.
 *
 * It used to be the other way round. This file held sparse cost *anchors* and
 * `buildLevels` filled the gaps geometrically, which put two thirds of the
 * table on a curve rather than on a source — and the anchors themselves
 * had drifted badly. A level 21 Cannon was priced at 22,500,000 gold against a
 * real 3,000,000, because a curve that keeps doubling does not know that the
 * game flattens out at the top. The error grew with the Town Hall, exactly
 * where people rely on the number.
 *
 * The route that fixed it is the one `builder-base.json` already used: each
 * structure's own wiki page, which publishes a clean per-level table. The Town
 * Hall page's own tables merge cells across several hall levels and cannot be
 * read positionally without silently shifting columns.
 *
 * Two ceilings are derived rather than transcribed, both from the structure's
 * own table:
 *
 *  - the ceiling at a hall is the highest level whose published "Town Hall
 *    Level Required" that hall meets;
 *  - `count` is the un-merged figure. From Town Hall 16 the game lets pairs of
 *    defences merge — Cannons into a Ricochet Cannon, Archer Towers into a
 *    Multi-Archer Tower — and the wiki gives both figures, e.g. "7/3". Seven is
 *    the number to plan against, because merging consumes buildings at their
 *    maximum level: a Cannon that ends up inside a Ricochet Cannon still has to
 *    be paid all the way up first. The merged figure describes the finished
 *    layout, not the bill.
 *
 * The one structure whose count genuinely falls is the Eagle Artillery, which
 * merges into the Town Hall's Giga Inferno at Town Hall 17 and is gone for
 * good.
 *
 * @see home-buildings.json for the data and the page each entry came from.
 */

import data from './home-buildings.json';

/**
 * Sparse per-Town-Hall table -> dense array.
 * `{ 7: 2, 9: 3 }` means "0 until TH7, then 2, then 3 from TH9 up".
 * Index 0 is unused so `arr[th]` reads naturally everywhere.
 */
export function byTH(spec: Record<number, number>): number[] {
  const out = new Array(MAX_TH + 1).fill(0);
  let cur = 0;
  for (let th = 1; th <= MAX_TH; th++) {
    if (spec[th] !== undefined) cur = spec[th];
    out[th] = cur;
  }
  return out;
}

interface RawLevel {
  cost: number;
  hours: number;
}

interface RawBuilding {
  name: string;
  category: string;
  size: number[];
  resource: string;
  count: Record<string, number>;
  max: Record<string, number>;
  levels: RawLevel[];
  /** Town Hall 18's extra levels past max; see `SUPERCHARGES`. */
  supercharge?: RawLevel[];
  page: string;
}

const numeric = (spec: Record<string, number>): Record<number, number> =>
  Object.fromEntries(Object.entries(spec).map(([k, v]) => [Number(k), v]));

/** Index 0 is unused so `levels[level]` reads naturally. */
const steps = (levels: RawLevel[]): (LevelStep | null)[] => [
  null,
  ...levels.map((l, i) => ({ level: i + 1, cost: l.cost, hours: l.hours, est: false })),
];

function build(id: string, raw: RawBuilding): Building {
  const count = byTH(numeric(raw.count));
  const max = byTH(numeric(raw.max));
  // A hall that cannot reach level 1 does not have the structure yet. The only
  // case is the Clan Castle, which the wiki counts from Town Hall 1 while its
  // own table needs Town Hall 2 for level 1 — at Town Hall 1 it is the pile of
  // rubble you repair, not a building you own.
  for (let th = 0; th < count.length; th++) if (max[th] === 0) count[th] = 0;
  return {
    id,
    name: raw.name,
    category: raw.category as BuildingCategory,
    resource: raw.resource as Resource,
    size: [raw.size[0], raw.size[1]] as const,
    count,
    max,
    maxLevel: raw.levels.length,
    unlockTH: count.findIndex((c) => c > 0),
    levels: steps(raw.levels),
  };
}

const RAW = data as unknown as Record<string, RawBuilding>;

export const BUILDINGS: Building[] = Object.entries(RAW).map(([id, raw]) => build(id, raw));

export const BUILDINGS_BY_ID: Record<string, Building> =
  Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

/** Every building available at a Town Hall, with its count and max level there. */
export function buildingsAtTH(th: number) {
  return BUILDINGS.filter((b) => b.count[th] > 0).map((b) => ({
    ...b,
    countHere: b.count[th],
    maxHere: b.max[th],
  }));
}

/**
 * Supercharges: the extra levels a maxed structure can take at Town Hall 18.
 *
 * A separate track from the normal one, and a temporary one — the game removes
 * them again when a new real level is added to the building. They are kept out
 * of `levels` and out of every cost-to-max total for that reason: a
 * supercharged Mortar is not a level 20 Mortar, and adding 16,000,000 gold of
 * charges to "what it costs to max your defences" would misstate the goal.
 */
export const SUPERCHARGES: Record<string, LevelStep[]> = Object.fromEntries(
  Object.entries(RAW)
    .filter(([, raw]) => raw.supercharge?.length)
    .map(([id, raw]) => [
      id,
      raw.supercharge!.map((l, i) => ({ level: i + 1, cost: l.cost, hours: l.hours, est: false })),
    ]),
);

export interface SuperchargeBill {
  cost: Record<Resource, number>;
  hours: number;
  /** Charge levels bought, counted per copy — what Sparky Stones are paid on. */
  charges: number;
  /** Copies of supercharged structures the hall allows. */
  structures: number;
  /** Kinds of structure with a charge track. */
  kinds: number;
}

/**
 * What supercharging everything a hall allows would cost, kept as a bill of
 * its own rather than folded into a cost-to-max — see `SUPERCHARGES`.
 *
 * Nothing below the top hall, which has no charge to buy. Above it, each copy
 * is charged separately, and each structure's charges are billed in that
 * structure's own currency: the Supercharge page prices a Gold Mine's charges
 * in elixir and a Monolith's in dark elixir, exactly as their levels are.
 */
export function superchargeBill(th: number): SuperchargeBill {
  const bill: SuperchargeBill = {
    cost: { gold: 0, elixir: 0, dark: 0 }, hours: 0, charges: 0, structures: 0, kinds: 0,
  };
  if (th < MAX_TH) return bill;

  for (const [id, charges] of Object.entries(SUPERCHARGES)) {
    const b = BUILDINGS_BY_ID[id];
    const copies = b?.count[th] ?? 0;
    if (!copies) continue;
    bill.kinds++;
    bill.structures += copies;
    bill.charges += charges.length * copies;
    for (const c of charges) {
      bill.cost[b.resource] += c.cost * copies;
      bill.hours += c.hours * copies;
    }
  }
  return bill;
}

/** The page each structure's numbers were read from, for provenance. */
export const BUILDING_SOURCE: Record<string, string> = Object.fromEntries(
  Object.entries(RAW).map(([id, raw]) => [id, raw.page]),
);
