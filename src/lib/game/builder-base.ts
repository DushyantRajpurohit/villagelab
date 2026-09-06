/**
 * Builder Base — the second village.
 *
 * Deliberately narrower than the Home Village dataset: levels and ceilings
 * only, no costs or upgrade times.
 *
 * The reason is honesty. The Home Village dataset is already ~76% interpolated
 * and that is the weakest thing about this project; adding a second, entirely
 * unanchored cost table would double down on the problem while looking like
 * more content. Progress against a ceiling is answerable from the API response
 * alone and is the question players actually ask ("how far off max am I?"), so
 * that is what this ships. Costs can follow once real values are anchored.
 *
 * @see BUILDER_CEILINGS_VERIFIED — the ceilings themselves still need checking.
 */

/** Builder Hall tops out at 10. */
export const MAX_BH = 10;

/**
 * False, and surfaced in the UI.
 *
 * These ceilings follow the game's standard pattern (a troop gains two levels
 * per Builder Hall after unlocking, capped at the hall's own limit) rather than
 * a per-troop table transcribed from the game. That makes them right in shape
 * and plausible in value, but they are not verified, and the interface says so
 * instead of presenting them as fact.
 */
export const BUILDER_CEILINGS_VERIFIED = false;

export type BuilderUnitKind = 'troop' | 'hero';

export interface BuilderUnit {
  id: string;
  name: string;
  kind: BuilderUnitKind;
  /** Max level per Builder Hall, indexed by BH. Index 0 is unused. */
  max: number[];
  maxLevel: number;
  unlockBH: number;
}

/** Sparse per-Builder-Hall table -> dense array, same shape as byTH. */
function byBH(spec: Record<number, number>): number[] {
  const out = new Array(MAX_BH + 1).fill(0);
  let cur = 0;
  for (let bh = 1; bh <= MAX_BH; bh++) {
    if (spec[bh] !== undefined) cur = spec[bh];
    out[bh] = cur;
  }
  return out;
}

function builderUnit(def: { id: string; name: string; kind: BuilderUnitKind; max: Record<number, number> }): BuilderUnit {
  const max = byBH(def.max);
  return {
    id: def.id,
    name: def.name,
    kind: def.kind,
    max,
    maxLevel: Math.max(...max),
    unlockBH: max.findIndex((v) => v > 0),
  };
}

export const BUILDER_TROOPS: BuilderUnit[] = [
  builderUnit({ id: 'raged_barbarian', name: 'Raged Barbarian', kind: 'troop',
    max: { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 12, 7: 14, 8: 16, 9: 18, 10: 20 } }),
  builderUnit({ id: 'sneaky_archer', name: 'Sneaky Archer', kind: 'troop',
    max: { 2: 2, 3: 4, 4: 6, 5: 8, 6: 10, 7: 12, 8: 14, 9: 16, 10: 18 } }),
  builderUnit({ id: 'boxer_giant', name: 'Boxer Giant', kind: 'troop',
    max: { 3: 2, 4: 4, 5: 6, 6: 8, 7: 10, 8: 12, 9: 14, 10: 16 } }),
  builderUnit({ id: 'beta_minion', name: 'Beta Minion', kind: 'troop',
    max: { 4: 2, 5: 4, 6: 6, 7: 8, 8: 10, 9: 12, 10: 14 } }),
  builderUnit({ id: 'bomber', name: 'Bomber', kind: 'troop',
    max: { 5: 2, 6: 4, 7: 6, 8: 8, 9: 10, 10: 12 } }),
  builderUnit({ id: 'baby_dragon', name: 'Baby Dragon', kind: 'troop',
    max: { 6: 2, 7: 4, 8: 6, 9: 8, 10: 10 } }),
  builderUnit({ id: 'cannon_cart', name: 'Cannon Cart', kind: 'troop',
    max: { 7: 2, 8: 4, 9: 6, 10: 8 } }),
  builderUnit({ id: 'night_witch', name: 'Night Witch', kind: 'troop',
    max: { 8: 2, 9: 4, 10: 6 } }),
  builderUnit({ id: 'drop_ship', name: 'Drop Ship', kind: 'troop',
    max: { 9: 2, 10: 4 } }),
  builderUnit({ id: 'power_pekka', name: 'Power P.E.K.K.A', kind: 'troop',
    max: { 9: 2, 10: 4 } }),
  builderUnit({ id: 'hog_glider', name: 'Hog Glider', kind: 'troop',
    max: { 10: 4 } }),
  builderUnit({ id: 'electrofire_wizard', name: 'Electrofire Wizard', kind: 'troop',
    max: { 10: 4 } }),
];

export const BUILDER_HEROES: BuilderUnit[] = [
  builderUnit({ id: 'battle_machine', name: 'Battle Machine', kind: 'hero',
    max: { 5: 5, 6: 10, 7: 15, 8: 20, 9: 25, 10: 30 } }),
  builderUnit({ id: 'battle_copter', name: 'Battle Copter', kind: 'hero',
    max: { 8: 10, 9: 20, 10: 30 } }),
];

export const BUILDER_UNITS: BuilderUnit[] = [...BUILDER_TROOPS, ...BUILDER_HEROES];

export const BUILDER_UNITS_BY_ID: Record<string, BuilderUnit> =
  Object.fromEntries(BUILDER_UNITS.map((u) => [u.id, u]));

/** Everything unlocked at a given Builder Hall, with its ceiling there. */
export function builderUnitsAtBH(bh: number) {
  return BUILDER_UNITS.filter((u) => u.max[bh] > 0).map((u) => ({ ...u, maxHere: u.max[bh] }));
}
