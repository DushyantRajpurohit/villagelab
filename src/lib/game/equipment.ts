import { byTH } from './buildings';
import type { Equipment, EquipmentStep, Ore, OreCost } from './types';
import data from './hero-equipment.json';

/**
 * Hero equipment — the 42 items the Blacksmith upgrades with ore.
 *
 * Every number is transcribed from the item's own wiki page, the same route
 * the buildings and units datasets take. Nothing is interpolated.
 *
 * Three things about equipment do not fit the building/unit mould, and each is
 * modelled rather than flattened away:
 *
 *  - **It costs ore, and often two or three at once.** A building or unit step
 *    spends exactly one currency, which is why `LevelStep` has a single `cost`.
 *    An equipment step carries an `OreCost` instead. See `Ore` in types.ts for
 *    why ores are not folded into `Resource`.
 *  - **Upgrades are instant.** There is no build time and no lane, so equipment
 *    never enters the planner's queue and has no hours to add to a total.
 *  - **The ceiling comes from the Blacksmith, not the Town Hall.** Each level
 *    publishes a Blacksmith level it needs; the Town Hall enters only through
 *    how far the Blacksmith can be upgraded there, exactly as the Laboratory
 *    gates troops. `max` is derived from that in the scrape, then bounded below
 *    by the hero's own unlock — a Grand Warden item cannot exist at Town Hall 8.
 *
 * The ore cost is uniform per rarity, which is a useful check on the
 * transcription: every common item costs 27,260 Shiny and 1,920 Glowy to take
 * from 1 to 18, and every epic 56,060 Shiny, 3,720 Glowy and 480 Starry to
 * take from 1 to 27. All 42 agree.
 *
 * One transcription caveat, carried from the source: for a handful of the
 * newest items the wiki fills the "Blacksmith Level Required" column with a
 * single value for every row rather than the usual per-level ladder
 * (1→3→5→7 for common, and 1→3→5→7→8→9 for epic). Those items therefore
 * unlock later here than the ladder would put them. It is the published
 * figure, and it errs towards requiring more rather than less.
 *
 * `max` is a ceiling, not a claim of ownership — see `Equipment` in types.ts.
 *
 * @see hero-equipment.json for the data and the page each entry came from.
 */

export const ORES: Ore[] = ['shiny', 'glowy', 'starry'];

export const ORE_NAME: Record<Ore, string> = {
  shiny: 'Shiny Ore', glowy: 'Glowy Ore', starry: 'Starry Ore',
};

interface RawStep extends Partial<Record<Ore, number>> {
  gate: number;
}

interface RawEquipment {
  name: string;
  hero: string;
  rarity: string;
  ability: string;
  gate: string;
  max: Record<string, number>;
  levels: RawStep[];
  page: string;
}

const RAW = data as unknown as Record<string, RawEquipment>;

const numeric = (spec: Record<string, number>): Record<number, number> =>
  Object.fromEntries(Object.entries(spec).map(([k, v]) => [Number(k), v]));

/** Index 0 is unused so `levels[level]` reads naturally. */
const steps = (levels: RawStep[]): (EquipmentStep | null)[] => [
  null,
  ...levels.map((l, i) => {
    const ore: OreCost = {};
    for (const o of ORES) if (l[o]) ore[o] = l[o];
    return { level: i + 1, ore, gate: l.gate };
  }),
];

function build(id: string, raw: RawEquipment): Equipment {
  const max = byTH(numeric(raw.max));
  return {
    id,
    name: raw.name,
    hero: raw.hero,
    rarity: raw.rarity as Equipment['rarity'],
    ability: raw.ability as Equipment['ability'],
    max,
    maxLevel: raw.levels.length,
    unlockTH: max.findIndex((v) => v > 0),
    levels: steps(raw.levels),
  };
}

export const EQUIPMENT: Equipment[] = Object.entries(RAW).map(([id, raw]) => build(id, raw));

export const EQUIPMENT_BY_ID: Record<string, Equipment> =
  Object.fromEntries(EQUIPMENT.map((e) => [e.id, e]));

/** Every item a hero can carry, in the dataset's order: commons first. */
export function equipmentForHero(heroId: string): Equipment[] {
  return EQUIPMENT.filter((e) => e.hero === heroId);
}

/** What this Town Hall can reach, for one hero or for all of them. */
export function equipmentAtTH(th: number, heroId?: string) {
  return EQUIPMENT
    .filter((e) => e.max[th] > 0 && (heroId === undefined || e.hero === heroId))
    .map((e) => ({ ...e, maxHere: e.max[th] }));
}

/** Add ore costs together. Absent ores stay absent rather than becoming 0. */
export function addOre(...costs: OreCost[]): OreCost {
  const out: OreCost = {};
  for (const c of costs) {
    for (const o of ORES) if (c[o]) out[o] = (out[o] ?? 0) + c[o]!;
  }
  return out;
}

/** Ore still owed to take an item from `level` to the ceiling at this hall. */
export function oreToMax(e: Equipment, level: number, th: number): OreCost {
  const cap = e.max[th];
  const owed: OreCost[] = [];
  for (let l = level + 1; l <= cap; l++) {
    const step = e.levels[l];
    if (step) owed.push(step.ore);
  }
  return addOre(...owed);
}

export const totalOre = (c: OreCost): number =>
  ORES.reduce((a, o) => a + (c[o] ?? 0), 0);

export const EQUIPMENT_SOURCE: Record<string, string> =
  Object.fromEntries(Object.entries(RAW).map(([id, raw]) => [id, raw.page]));
