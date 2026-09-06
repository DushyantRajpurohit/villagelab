import { buildLevels, type Anchors } from './curve';
import { MAX_TH } from './town-halls';
import type { Building, BuildingCategory, Resource } from './types';

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

interface BuildingDef {
  id: string;
  name: string;
  category: BuildingCategory;
  resource: Resource;
  size: readonly [number, number];
  /** Sparse count per Town Hall. */
  count: Record<number, number>;
  /** Sparse max level per Town Hall. */
  max: Record<number, number>;
  costs: Anchors;
  times: Anchors;
}

function building(def: BuildingDef): Building {
  const count = byTH(def.count);
  const max = byTH(def.max);
  const maxLevel = Math.max(...max);
  return {
    id: def.id,
    name: def.name,
    category: def.category,
    resource: def.resource,
    size: def.size,
    count,
    max,
    maxLevel,
    unlockTH: count.findIndex((c) => c > 0),
    levels: buildLevels(maxLevel, def.costs, def.times),
  };
}

export const BUILDINGS: Building[] = [
  // ---------------------------------------------------------------- defenses
  building({
    id: 'cannon', name: 'Cannon', category: 'defense', resource: 'gold', size: [3, 3] as const,
    count: { 1: 2, 5: 3, 7: 4, 8: 5, 10: 6, 11: 7, 15: 8 },
    max: { 1: 2, 2: 3, 3: 4, 4: 6, 5: 7, 6: 8, 7: 9, 8: 10, 9: 11, 10: 13, 11: 15, 12: 16, 13: 18, 14: 19, 15: 20, 16: 21, 17: 22 },
    costs: { 1: 270, 5: 12000, 8: 400000, 11: 3200000, 14: 8100000, 17: 13500000, 20: 19000000, 22: 22500000 },
    times: { 1: 0.02, 5: 2, 8: 24, 11: 108, 14: 216, 17: 312, 20: 408, 22: 456 },
  }),
  building({
    id: 'archer_tower', name: 'Archer Tower', category: 'defense', resource: 'gold', size: [3, 3] as const,
    count: { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 9: 8, 13: 9, 15: 10 },
    max: { 2: 3, 3: 4, 4: 6, 5: 7, 6: 8, 7: 9, 8: 10, 9: 11, 10: 12, 11: 14, 12: 16, 13: 18, 14: 19, 15: 20, 16: 21, 17: 22 },
    costs: { 1: 1000, 5: 20000, 8: 500000, 11: 3400000, 14: 8300000, 17: 13800000, 20: 19200000, 22: 22800000 },
    times: { 1: 0.05, 5: 3, 8: 30, 11: 120, 14: 228, 17: 324, 20: 414, 22: 462 },
  }),
  building({
    id: 'mortar', name: 'Mortar', category: 'defense', resource: 'gold', size: [3, 3] as const,
    count: { 3: 1, 5: 2, 7: 3, 10: 4 },
    max: { 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8, 10: 9, 11: 10, 12: 11, 13: 12, 14: 13, 15: 14, 16: 15, 17: 16 },
    costs: { 1: 8000, 4: 250000, 7: 1600000, 10: 5000000, 13: 10600000, 16: 17500000 },
    times: { 1: 8, 4: 24, 7: 96, 10: 192, 13: 300, 16: 396 },
  }),
  building({
    id: 'air_defense', name: 'Air Defense', category: 'defense', resource: 'gold', size: [3, 3] as const,
    count: { 4: 1, 6: 2, 7: 3, 9: 4 },
    max: { 4: 2, 5: 3, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 13: 11, 14: 12, 15: 13, 16: 14, 17: 15 },
    costs: { 1: 22500, 4: 500000, 7: 2400000, 10: 6300000, 13: 12000000, 15: 17000000 },
    times: { 1: 12, 4: 36, 7: 120, 10: 216, 13: 312, 15: 384 },
  }),
  building({
    id: 'wizard_tower', name: 'Wizard Tower', category: 'defense', resource: 'gold', size: [3, 3] as const,
    count: { 5: 1, 6: 2, 8: 3, 9: 4, 11: 5 },
    max: { 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7, 11: 8, 12: 9, 13: 11, 14: 12, 15: 13, 16: 14, 17: 15 },
    costs: { 1: 180000, 4: 1200000, 7: 4000000, 10: 8000000, 13: 13500000, 15: 18000000 },
    times: { 1: 16, 4: 48, 7: 144, 10: 240, 13: 336, 15: 396 },
  }),
  building({
    id: 'air_sweeper', name: 'Air Sweeper', category: 'defense', resource: 'gold', size: [2, 2] as const,
    count: { 6: 1, 8: 2 },
    max: { 6: 1, 7: 2, 8: 3, 9: 4, 10: 5, 11: 6, 12: 7, 16: 8 },
    costs: { 1: 150000, 4: 1600000, 7: 6000000, 8: 9000000 },
    times: { 1: 12, 4: 60, 7: 180, 8: 240 },
  }),
  building({
    id: 'hidden_tesla', name: 'Hidden Tesla', category: 'defense', resource: 'gold', size: [2, 2] as const,
    count: { 7: 2, 8: 3, 9: 4, 11: 5 },
    max: { 7: 3, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 13: 11, 14: 12, 15: 13, 16: 14, 17: 15 },
    costs: { 1: 100000, 4: 700000, 7: 2800000, 10: 7200000, 13: 12800000, 15: 17600000 },
    times: { 1: 12, 4: 48, 7: 132, 10: 228, 13: 324, 15: 390 },
  }),
  building({
    id: 'bomb_tower', name: 'Bomb Tower', category: 'defense', resource: 'gold', size: [3, 3] as const,
    count: { 8: 1, 9: 2 },
    max: { 8: 2, 9: 3, 10: 4, 11: 5, 12: 6, 13: 7, 14: 8, 15: 9, 16: 10, 17: 11 },
    costs: { 1: 500000, 4: 2400000, 7: 7000000, 11: 15000000 },
    times: { 1: 24, 4: 96, 7: 216, 11: 372 },
  }),
  building({
    id: 'xbow', name: 'X-Bow', category: 'defense', resource: 'gold', size: [3, 3] as const,
    count: { 9: 2, 10: 3, 11: 4 },
    max: { 9: 2, 10: 4, 11: 5, 12: 6, 13: 7, 14: 8, 15: 9, 16: 10, 17: 11 },
    costs: { 1: 1000000, 4: 4000000, 7: 9500000, 11: 18500000 },
    times: { 1: 48, 4: 144, 7: 264, 11: 420 },
  }),
  building({
    id: 'inferno_tower', name: 'Inferno Tower', category: 'defense', resource: 'gold', size: [3, 3] as const,
    count: { 10: 2, 12: 3 },
    max: { 10: 2, 11: 3, 12: 5, 13: 6, 14: 7, 15: 8, 16: 9, 17: 10 },
    costs: { 1: 2400000, 4: 6800000, 7: 13000000, 10: 20000000 },
    times: { 1: 96, 4: 192, 7: 312, 10: 432 },
  }),
  building({
    id: 'eagle_artillery', name: 'Eagle Artillery', category: 'defense', resource: 'gold', size: [4, 4] as const,
    count: { 11: 1 },
    max: { 11: 2, 12: 3, 13: 4, 14: 5, 15: 6, 16: 7, 17: 8 },
    costs: { 1: 8000000, 4: 13000000, 8: 21000000 },
    times: { 1: 168, 4: 288, 8: 456 },
  }),
  building({
    id: 'scattershot', name: 'Scattershot', category: 'defense', resource: 'gold', size: [3, 3] as const,
    count: { 13: 2 },
    max: { 13: 2, 14: 3, 15: 4, 16: 5, 17: 6 },
    costs: { 1: 9000000, 3: 13000000, 6: 20000000 },
    times: { 1: 192, 3: 288, 6: 432 },
  }),
  building({
    id: 'monolith', name: 'Monolith', category: 'defense', resource: 'gold', size: [3, 3] as const,
    count: { 15: 1 },
    max: { 15: 2, 16: 3, 17: 4 },
    costs: { 1: 11000000, 4: 21000000 },
    times: { 1: 264, 4: 456 },
  }),
  building({
    id: 'spell_tower', name: 'Spell Tower', category: 'defense', resource: 'gold', size: [3, 3] as const,
    count: { 15: 1, 16: 2 },
    max: { 15: 2, 16: 3, 17: 4 },
    costs: { 1: 10000000, 4: 20000000 },
    times: { 1: 240, 4: 444 },
  }),
  building({
    id: 'multi_archer_tower', name: 'Multi-Archer Tower', category: 'defense', resource: 'gold', size: [3, 3] as const,
    count: { 16: 1 },
    max: { 16: 2, 17: 3 },
    costs: { 1: 12500000, 3: 21500000 },
    times: { 1: 288, 3: 456 },
  }),
  building({
    id: 'ricochet_cannon', name: 'Ricochet Cannon', category: 'defense', resource: 'gold', size: [3, 3] as const,
    count: { 16: 1 },
    max: { 16: 2, 17: 3 },
    costs: { 1: 12500000, 3: 21500000 },
    times: { 1: 288, 3: 456 },
  }),
  building({
    id: 'multi_gear_tower', name: 'Multi-Gear Tower', category: 'defense', resource: 'gold', size: [3, 3] as const,
    count: { 16: 1 },
    max: { 16: 2, 17: 3 },
    costs: { 1: 12500000, 3: 21500000 },
    times: { 1: 288, 3: 456 },
  }),
  building({
    id: 'firespitter', name: 'Firespitter', category: 'defense', resource: 'gold', size: [3, 3] as const,
    count: { 17: 1 },
    max: { 17: 3 },
    costs: { 1: 16000000, 3: 22500000 },
    times: { 1: 336, 3: 468 },
  }),

  // ------------------------------------------------------------------- walls
  building({
    id: 'wall', name: 'Wall', category: 'wall', resource: 'gold', size: [1, 1] as const,
    count: { 2: 25, 3: 50, 4: 75, 5: 100, 6: 125, 7: 175, 8: 225, 9: 250, 10: 275, 11: 300, 12: 325 },
    max: { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15, 16: 16, 17: 17 },
    costs: { 1: 50, 5: 7000, 9: 500000, 12: 2000000, 14: 4000000, 16: 7000000, 17: 8000000 },
    times: { 1: 0, 17: 0 }, // walls are instant
  }),

  // --------------------------------------------------------------- resources
  building({
    id: 'gold_mine', name: 'Gold Mine', category: 'resource', resource: 'elixir', size: [3, 3] as const,
    count: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 9: 7 },
    max: { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 11, 7: 12, 8: 12, 9: 13, 10: 13, 11: 14, 12: 14, 13: 15, 14: 15, 15: 16, 16: 16, 17: 17 },
    costs: { 1: 150, 5: 25000, 9: 800000, 13: 4000000, 17: 9000000 },
    times: { 1: 0.02, 5: 3, 9: 36, 13: 120, 17: 216 },
  }),
  building({
    id: 'elixir_collector', name: 'Elixir Collector', category: 'resource', resource: 'gold', size: [3, 3] as const,
    count: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 9: 7 },
    max: { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 11, 7: 12, 8: 12, 9: 13, 10: 13, 11: 14, 12: 14, 13: 15, 14: 15, 15: 16, 16: 16, 17: 17 },
    costs: { 1: 150, 5: 25000, 9: 800000, 13: 4000000, 17: 9000000 },
    times: { 1: 0.02, 5: 3, 9: 36, 13: 120, 17: 216 },
  }),
  building({
    id: 'dark_drill', name: 'Dark Elixir Drill', category: 'resource', resource: 'elixir', size: [3, 3] as const,
    count: { 7: 1, 8: 2, 9: 3 },
    max: { 7: 3, 8: 5, 9: 6, 10: 7, 11: 8, 12: 8, 13: 9, 14: 9, 15: 10, 16: 10, 17: 11 },
    costs: { 1: 1000000, 5: 4000000, 8: 8000000, 11: 12000000 },
    times: { 1: 24, 5: 96, 8: 192, 11: 288 },
  }),
  building({
    id: 'gold_storage', name: 'Gold Storage', category: 'resource', resource: 'elixir', size: [3, 3] as const,
    count: { 1: 1, 3: 2, 7: 3, 9: 4 },
    max: { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7, 6: 8, 7: 9, 8: 10, 9: 11, 10: 12, 11: 13, 12: 14, 13: 15, 14: 16, 15: 17, 16: 18, 17: 19 },
    costs: { 1: 300, 6: 100000, 11: 3000000, 15: 8000000, 19: 13000000 },
    times: { 1: 0.05, 6: 12, 11: 96, 15: 216, 19: 336 },
  }),
  building({
    id: 'elixir_storage', name: 'Elixir Storage', category: 'resource', resource: 'gold', size: [3, 3] as const,
    count: { 1: 1, 3: 2, 7: 3, 9: 4 },
    max: { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7, 6: 8, 7: 9, 8: 10, 9: 11, 10: 12, 11: 13, 12: 14, 13: 15, 14: 16, 15: 17, 16: 18, 17: 19 },
    costs: { 1: 300, 6: 100000, 11: 3000000, 15: 8000000, 19: 13000000 },
    times: { 1: 0.05, 6: 12, 11: 96, 15: 216, 19: 336 },
  }),
  building({
    id: 'dark_storage', name: 'Dark Elixir Storage', category: 'resource', resource: 'gold', size: [3, 3] as const,
    count: { 7: 1 },
    max: { 7: 2, 8: 3, 9: 4, 10: 5, 11: 6, 12: 7, 13: 8, 14: 9, 15: 10, 16: 11, 17: 12 },
    costs: { 1: 600000, 5: 3000000, 9: 8000000, 12: 13000000 },
    times: { 1: 24, 5: 96, 9: 216, 12: 312 },
  }),

  // -------------------------------------------------------------------- army
  building({
    id: 'army_camp', name: 'Army Camp', category: 'army', resource: 'elixir', size: [4, 4] as const,
    count: { 1: 1, 4: 2, 6: 3, 8: 4 },
    max: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 8, 10: 9, 11: 10, 12: 11, 13: 12, 14: 13, 15: 14, 16: 15, 17: 16 },
    costs: { 1: 250, 5: 100000, 9: 1500000, 13: 6000000, 16: 11000000 },
    times: { 1: 0.1, 5: 12, 9: 96, 13: 216, 16: 336 },
  }),
  building({
    id: 'barracks', name: 'Barracks', category: 'army', resource: 'elixir', size: [3, 3] as const,
    count: { 1: 1, 4: 2, 7: 3, 9: 4 },
    max: { 1: 1, 2: 3, 3: 5, 4: 6, 5: 7, 6: 8, 7: 9, 8: 10, 9: 11, 10: 12, 11: 13, 12: 14, 13: 15, 14: 16, 15: 17, 16: 18, 17: 19 },
    costs: { 1: 200, 6: 60000, 11: 1600000, 15: 6500000, 19: 11500000 },
    times: { 1: 0.02, 6: 6, 11: 48, 15: 144, 19: 264 },
  }),
  building({
    id: 'dark_barracks', name: 'Dark Barracks', category: 'army', resource: 'elixir', size: [3, 3] as const,
    count: { 7: 1, 8: 2 },
    max: { 7: 2, 8: 4, 9: 5, 10: 6, 11: 7, 12: 8, 13: 9, 14: 10, 15: 11, 16: 12, 17: 13 },
    costs: { 1: 750000, 5: 3000000, 9: 7000000, 13: 12000000 },
    times: { 1: 12, 5: 48, 9: 144, 13: 264 },
  }),
  building({
    id: 'laboratory', name: 'Laboratory', category: 'army', resource: 'elixir', size: [4, 4] as const,
    count: { 3: 1 },
    max: { 3: 1, 4: 2, 5: 3, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 13: 11, 14: 12, 15: 13, 16: 14, 17: 15 },
    costs: { 1: 25000, 5: 600000, 9: 4000000, 12: 8500000, 15: 13500000 },
    times: { 1: 0.5, 5: 24, 9: 144, 12: 264, 15: 360 },
  }),
  building({
    id: 'spell_factory', name: 'Spell Factory', category: 'army', resource: 'elixir', size: [3, 3] as const,
    count: { 5: 1 },
    max: { 5: 1, 6: 2, 7: 3, 8: 4, 9: 5, 10: 5, 11: 6, 12: 6, 13: 7, 15: 8 },
    costs: { 1: 200000, 4: 1600000, 8: 8000000 },
    times: { 1: 12, 4: 72, 8: 240 },
  }),
  building({
    id: 'dark_spell_factory', name: 'Dark Spell Factory', category: 'army', resource: 'elixir', size: [3, 3] as const,
    count: { 8: 1 },
    max: { 8: 1, 9: 2, 10: 3, 11: 4, 12: 5, 14: 6 },
    costs: { 1: 1500000, 3: 4000000, 6: 9500000 },
    times: { 1: 24, 3: 96, 6: 240 },
  }),
  building({
    id: 'workshop', name: 'Workshop', category: 'army', resource: 'elixir', size: [4, 4] as const,
    count: { 12: 1 },
    max: { 12: 2, 13: 4, 14: 5, 15: 6, 16: 7, 17: 8 },
    costs: { 1: 5000000, 4: 10000000, 8: 16000000 },
    times: { 1: 120, 4: 240, 8: 384 },
  }),
  building({
    id: 'pet_house', name: 'Pet House', category: 'army', resource: 'elixir', size: [3, 3] as const,
    count: { 14: 1 },
    max: { 14: 4, 15: 6, 16: 8, 17: 10 },
    costs: { 1: 8000000, 5: 13000000, 10: 19000000 },
    times: { 1: 144, 5: 264, 10: 408 },
  }),
  building({
    id: 'blacksmith', name: 'Blacksmith', category: 'army', resource: 'elixir', size: [3, 3] as const,
    count: { 8: 1 },
    max: { 8: 1, 9: 2, 10: 3, 11: 4, 12: 5, 13: 6, 14: 7, 15: 8, 16: 9, 17: 10 },
    costs: { 1: 1000000, 5: 5000000, 10: 14000000 },
    times: { 1: 24, 5: 120, 10: 312 },
  }),
  building({
    id: 'clan_castle', name: 'Clan Castle', category: 'army', resource: 'gold', size: [3, 3] as const,
    count: { 3: 1 },
    max: { 3: 1, 5: 2, 7: 3, 8: 4, 9: 5, 10: 6, 11: 7, 12: 8, 13: 9, 14: 10, 15: 11, 16: 12, 17: 13 },
    costs: { 1: 10000, 5: 800000, 9: 5000000, 13: 12000000 },
    times: { 1: 0.02, 5: 48, 9: 168, 13: 312 },
  }),
  building({
    id: 'builders_hut', name: "Builder's Hut", category: 'other', resource: 'gold', size: [2, 2] as const,
    count: { 1: 5, 12: 6 },
    max: { 1: 1, 15: 4 },
    costs: { 1: 0, 4: 8000000 },
    times: { 1: 0, 4: 216 },
  }),

  // ------------------------------------------------------------------- traps
  building({
    id: 'bomb', name: 'Bomb', category: 'trap', resource: 'gold', size: [1, 1] as const,
    count: { 3: 2, 4: 4, 6: 5, 8: 6 },
    max: { 3: 2, 5: 3, 7: 4, 9: 6, 11: 8, 13: 10, 15: 11, 17: 12 },
    costs: { 1: 400, 6: 60000, 12: 1600000 },
    times: { 1: 0.02, 6: 4, 12: 48 },
  }),
  building({
    id: 'spring_trap', name: 'Spring Trap', category: 'trap', resource: 'gold', size: [1, 1] as const,
    count: { 4: 2, 6: 4, 9: 6 },
    max: { 4: 1, 9: 2, 11: 3, 13: 4, 15: 5, 17: 6 },
    costs: { 1: 2000, 6: 900000 },
    times: { 1: 0.05, 6: 24 },
  }),
  building({
    id: 'air_bomb', name: 'Air Bomb', category: 'trap', resource: 'gold', size: [1, 1] as const,
    count: { 5: 2, 7: 3, 9: 4, 11: 5 },
    max: { 5: 2, 7: 3, 9: 5, 11: 7, 13: 9, 15: 10, 17: 11 },
    costs: { 1: 4000, 6: 200000, 11: 2400000 },
    times: { 1: 0.1, 6: 8, 11: 60 },
  }),
  building({
    id: 'giant_bomb', name: 'Giant Bomb', category: 'trap', resource: 'gold', size: [2, 2] as const,
    count: { 6: 1, 7: 2, 9: 4, 11: 5, 13: 6 },
    max: { 6: 1, 8: 3, 10: 5, 12: 7, 14: 8, 16: 9, 17: 10 },
    costs: { 1: 12500, 5: 400000, 10: 4000000 },
    times: { 1: 0.5, 5: 12, 10: 96 },
  }),
  building({
    id: 'seeking_air_mine', name: 'Seeking Air Mine', category: 'trap', resource: 'gold', size: [1, 1] as const,
    count: { 8: 1, 9: 2, 11: 4, 13: 5 },
    max: { 8: 1, 10: 2, 12: 3, 14: 4, 16: 5, 17: 6 },
    costs: { 1: 150000, 6: 4000000 },
    times: { 1: 6, 6: 96 },
  }),
  building({
    id: 'skeleton_trap', name: 'Skeleton Trap', category: 'trap', resource: 'gold', size: [1, 1] as const,
    count: { 9: 2, 11: 3, 13: 4 },
    max: { 9: 2, 11: 3, 13: 4, 15: 5 },
    costs: { 1: 100000, 5: 2400000 },
    times: { 1: 4, 5: 60 },
  }),
  building({
    id: 'tornado_trap', name: 'Tornado Trap', category: 'trap', resource: 'gold', size: [2, 2] as const,
    count: { 11: 1 },
    max: { 11: 2, 13: 3, 16: 4 },
    costs: { 1: 2000000, 4: 8000000 },
    times: { 1: 48, 4: 168 },
  }),
];


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
