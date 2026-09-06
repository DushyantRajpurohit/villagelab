import { costSeries, timeSeries } from './curve.js';
import { byTH } from './buildings.js';

function unit(def) {
  const max = byTH(def.max);
  const maxLevel = Math.max(...max);
  const c = costSeries(maxLevel, def.costs);
  const t = timeSeries(maxLevel, def.times);
  const levels = [null];
  for (let l = 1; l <= maxLevel; l++) {
    levels.push({ level: l, cost: c[l].value, hours: t[l].value, est: c[l].est || t[l].est });
  }
  return { ...def, max, maxLevel, unlockTH: max.findIndex((v) => v > 0), levels };
}

/** Elixir troops (Barracks + Laboratory). */
export const TROOPS = [
  unit({ id: 'barbarian', name: 'Barbarian', kind: 'troop', resource: 'elixir', housing: 1,
    max: { 1: 2, 3: 3, 5: 4, 7: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 13: 11, 14: 12, 15: 13, 16: 13, 17: 14 },
    costs: { 2: 20000, 6: 750000, 10: 4000000, 14: 11000000 }, times: { 2: 2, 6: 24, 10: 108, 14: 240 } }),
  unit({ id: 'archer', name: 'Archer', kind: 'troop', resource: 'elixir', housing: 1,
    max: { 1: 2, 3: 3, 5: 4, 7: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 13: 11, 14: 12, 15: 13, 16: 13, 17: 14 },
    costs: { 2: 30000, 6: 800000, 10: 4200000, 14: 11200000 }, times: { 2: 2, 6: 26, 10: 112, 14: 244 } }),
  unit({ id: 'giant', name: 'Giant', kind: 'troop', resource: 'elixir', housing: 5,
    max: { 1: 2, 3: 3, 5: 4, 7: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 13: 11, 14: 12, 16: 13 },
    costs: { 2: 50000, 6: 1000000, 10: 5000000, 13: 11500000 }, times: { 2: 3, 6: 36, 10: 132, 13: 252 } }),
  unit({ id: 'goblin', name: 'Goblin', kind: 'troop', resource: 'elixir', housing: 1,
    max: { 2: 2, 4: 3, 6: 4, 8: 5, 10: 6, 11: 7, 13: 8, 15: 9, 17: 10 },
    costs: { 2: 40000, 6: 900000, 10: 6000000 }, times: { 2: 2, 6: 30, 10: 168 } }),
  unit({ id: 'wall_breaker', name: 'Wall Breaker', kind: 'troop', resource: 'elixir', housing: 2,
    max: { 3: 2, 5: 3, 7: 4, 8: 5, 9: 6, 10: 7, 11: 8, 12: 9, 13: 10, 14: 11, 15: 12, 17: 13 },
    costs: { 2: 60000, 6: 1200000, 10: 5500000, 13: 11500000 }, times: { 2: 3, 6: 36, 10: 144, 13: 264 } }),
  unit({ id: 'balloon', name: 'Balloon', kind: 'troop', resource: 'elixir', housing: 5,
    max: { 4: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7, 11: 8, 12: 9, 13: 10, 14: 11, 15: 12, 17: 13 },
    costs: { 2: 100000, 6: 1600000, 10: 6000000, 13: 12000000 }, times: { 2: 4, 6: 48, 10: 156, 13: 276 } }),
  unit({ id: 'wizard', name: 'Wizard', kind: 'troop', resource: 'elixir', housing: 4,
    max: { 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7, 11: 8, 12: 9, 13: 10, 14: 11, 15: 12, 16: 13, 17: 14 },
    costs: { 2: 120000, 6: 1800000, 10: 6500000, 14: 12500000 }, times: { 2: 5, 6: 54, 10: 168, 14: 288 } }),
  unit({ id: 'healer', name: 'Healer', kind: 'troop', resource: 'elixir', housing: 14,
    max: { 6: 2, 8: 3, 9: 4, 11: 5, 13: 6, 14: 7, 16: 8, 17: 9 },
    costs: { 2: 300000, 5: 3000000, 9: 12000000 }, times: { 2: 12, 5: 96, 9: 264 } }),
  unit({ id: 'dragon', name: 'Dragon', kind: 'troop', resource: 'elixir', housing: 20,
    max: { 7: 2, 8: 3, 9: 4, 10: 5, 11: 6, 12: 7, 13: 8, 14: 9, 15: 10, 16: 11, 17: 12 },
    costs: { 2: 500000, 6: 3500000, 12: 12500000 }, times: { 2: 24, 6: 108, 12: 288 } }),
  unit({ id: 'pekka', name: 'P.E.K.K.A', kind: 'troop', resource: 'elixir', housing: 25,
    max: { 8: 2, 9: 4, 10: 5, 11: 6, 12: 7, 13: 8, 14: 9, 15: 10, 16: 11, 17: 12 },
    costs: { 2: 700000, 6: 4500000, 12: 13000000 }, times: { 2: 30, 6: 132, 12: 300 } }),
  unit({ id: 'baby_dragon', name: 'Baby Dragon', kind: 'troop', resource: 'elixir', housing: 10,
    max: { 9: 3, 10: 4, 11: 5, 12: 6, 13: 7, 14: 8, 15: 9, 16: 10, 17: 11 },
    costs: { 2: 800000, 6: 5000000, 11: 12500000 }, times: { 2: 36, 6: 144, 11: 288 } }),
  unit({ id: 'miner', name: 'Miner', kind: 'troop', resource: 'elixir', housing: 6,
    max: { 10: 3, 11: 5, 12: 6, 13: 7, 14: 8, 15: 9, 16: 10, 17: 11 },
    costs: { 2: 1200000, 6: 6000000, 11: 13000000 }, times: { 2: 48, 6: 168, 11: 300 } }),
  unit({ id: 'electro_dragon', name: 'Electro Dragon', kind: 'troop', resource: 'elixir', housing: 30,
    max: { 11: 2, 12: 3, 13: 4, 14: 5, 15: 6, 16: 7, 17: 8 },
    costs: { 2: 3000000, 5: 8000000, 8: 14000000 }, times: { 2: 96, 5: 192, 8: 312 } }),
  unit({ id: 'yeti', name: 'Yeti', kind: 'troop', resource: 'elixir', housing: 18,
    max: { 12: 2, 13: 3, 14: 4, 15: 5, 16: 6, 17: 7 },
    costs: { 2: 4000000, 5: 10000000, 7: 14500000 }, times: { 2: 120, 5: 240, 7: 324 } }),
  unit({ id: 'dragon_rider', name: 'Dragon Rider', kind: 'troop', resource: 'elixir', housing: 25,
    max: { 13: 2, 14: 3, 15: 4, 16: 5, 17: 6 },
    costs: { 2: 6000000, 4: 10500000, 6: 14500000 }, times: { 2: 168, 4: 264, 6: 336 } }),
  unit({ id: 'electro_titan', name: 'Electro Titan', kind: 'troop', resource: 'elixir', housing: 32,
    max: { 14: 2, 15: 3, 16: 4, 17: 5 },
    costs: { 2: 9000000, 5: 15000000 }, times: { 2: 216, 5: 348 } }),
  unit({ id: 'root_rider', name: 'Root Rider', kind: 'troop', resource: 'elixir', housing: 20,
    max: { 15: 2, 16: 3, 17: 4 },
    costs: { 2: 11000000, 4: 15500000 }, times: { 2: 264, 4: 360 } }),
  unit({ id: 'thrower', name: 'Thrower', kind: 'troop', resource: 'elixir', housing: 16,
    max: { 16: 2, 17: 3 },
    costs: { 2: 13000000, 3: 16000000 }, times: { 2: 300, 3: 372 } }),
];

/** Dark Elixir troops (Dark Barracks + Laboratory). */
export const DARK_TROOPS = [
  unit({ id: 'minion', name: 'Minion', kind: 'troop', resource: 'dark', housing: 2,
    max: { 7: 2, 8: 4, 9: 6, 10: 7, 11: 8, 12: 9, 13: 10, 14: 11, 15: 12, 17: 13 },
    costs: { 2: 12000, 6: 90000, 10: 240000, 13: 375000 }, times: { 2: 12, 6: 96, 10: 204, 13: 288 } }),
  unit({ id: 'hog_rider', name: 'Hog Rider', kind: 'troop', resource: 'dark', housing: 5,
    max: { 7: 2, 8: 4, 9: 5, 10: 7, 11: 8, 12: 9, 13: 10, 14: 11, 15: 12, 16: 13, 17: 14 },
    costs: { 2: 20000, 6: 110000, 10: 260000, 14: 390000 }, times: { 2: 16, 6: 108, 10: 216, 14: 300 } }),
  unit({ id: 'valkyrie', name: 'Valkyrie', kind: 'troop', resource: 'dark', housing: 8,
    max: { 8: 2, 9: 4, 10: 5, 11: 6, 12: 7, 13: 8, 14: 9, 15: 10, 16: 11, 17: 12 },
    costs: { 2: 35000, 6: 130000, 12: 380000 }, times: { 2: 24, 6: 120, 12: 288 } }),
  unit({ id: 'golem', name: 'Golem', kind: 'troop', resource: 'dark', housing: 30,
    max: { 8: 2, 9: 5, 10: 7, 11: 9, 12: 10, 13: 11, 14: 12, 15: 13, 16: 14, 17: 15 },
    costs: { 2: 30000, 7: 150000, 15: 400000 }, times: { 2: 24, 7: 132, 15: 300 } }),
  unit({ id: 'witch', name: 'Witch', kind: 'troop', resource: 'dark', housing: 12,
    max: { 9: 2, 10: 3, 11: 4, 12: 5, 13: 6, 14: 7, 15: 8, 16: 9, 17: 10 },
    costs: { 2: 60000, 6: 180000, 10: 400000 }, times: { 2: 48, 6: 156, 10: 300 } }),
  unit({ id: 'lava_hound', name: 'Lava Hound', kind: 'troop', resource: 'dark', housing: 30,
    max: { 9: 2, 10: 3, 11: 4, 12: 5, 13: 6, 14: 7, 15: 8, 16: 9, 17: 10 },
    costs: { 2: 70000, 6: 200000, 10: 410000 }, times: { 2: 48, 6: 168, 10: 300 } }),
  unit({ id: 'bowler', name: 'Bowler', kind: 'troop', resource: 'dark', housing: 6,
    max: { 10: 2, 11: 3, 12: 4, 13: 5, 14: 6, 15: 7, 16: 8, 17: 9 },
    costs: { 2: 90000, 5: 220000, 9: 420000 }, times: { 2: 60, 5: 168, 9: 300 } }),
  unit({ id: 'ice_golem', name: 'Ice Golem', kind: 'troop', resource: 'dark', housing: 15,
    max: { 11: 2, 12: 4, 13: 5, 14: 6, 15: 7, 16: 8, 17: 9 },
    costs: { 2: 110000, 5: 250000, 9: 420000 }, times: { 2: 72, 5: 180, 9: 300 } }),
  unit({ id: 'headhunter', name: 'Headhunter', kind: 'troop', resource: 'dark', housing: 6,
    max: { 12: 2, 13: 3, 14: 4, 15: 5, 16: 6, 17: 7 },
    costs: { 2: 150000, 4: 260000, 7: 420000 }, times: { 2: 96, 4: 192, 7: 300 } }),
  unit({ id: 'apprentice_warden', name: 'Apprentice Warden', kind: 'troop', resource: 'dark', housing: 20,
    max: { 14: 2, 15: 3, 16: 4, 17: 5 },
    costs: { 2: 220000, 5: 430000 }, times: { 2: 168, 5: 312 } }),
  unit({ id: 'druid', name: 'Druid', kind: 'troop', resource: 'dark', housing: 20,
    max: { 15: 2, 16: 3, 17: 4 },
    costs: { 2: 280000, 4: 440000 }, times: { 2: 216, 4: 324 } }),
];

/** Elixir + Dark spells (Spell Factory / Dark Spell Factory + Laboratory). */
export const SPELLS = [
  unit({ id: 'lightning', name: 'Lightning Spell', kind: 'spell', resource: 'elixir', housing: 2,
    max: { 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7, 11: 8, 12: 9, 14: 10, 16: 11 },
    costs: { 2: 400000, 6: 3000000, 11: 12000000 }, times: { 2: 24, 6: 108, 11: 264 } }),
  unit({ id: 'healing', name: 'Healing Spell', kind: 'spell', resource: 'elixir', housing: 2,
    max: { 6: 2, 8: 3, 9: 5, 11: 6, 12: 7, 13: 8, 15: 9, 17: 10 },
    costs: { 2: 600000, 5: 3500000, 10: 12000000 }, times: { 2: 36, 5: 120, 10: 264 } }),
  unit({ id: 'rage', name: 'Rage Spell', kind: 'spell', resource: 'elixir', housing: 2,
    max: { 7: 2, 8: 3, 9: 4, 11: 5, 13: 6, 15: 7 },
    costs: { 2: 900000, 4: 4000000, 7: 11000000 }, times: { 2: 48, 4: 132, 7: 252 } }),
  unit({ id: 'jump', name: 'Jump Spell', kind: 'spell', resource: 'elixir', housing: 2,
    max: { 9: 2, 11: 3, 13: 4, 15: 5 },
    costs: { 2: 2000000, 5: 11000000 }, times: { 2: 72, 5: 252 } }),
  unit({ id: 'freeze', name: 'Freeze Spell', kind: 'spell', resource: 'elixir', housing: 1,
    max: { 9: 2, 10: 4, 11: 5, 12: 6, 14: 7, 16: 8 },
    costs: { 2: 1600000, 5: 6000000, 8: 12000000 }, times: { 2: 60, 5: 168, 8: 264 } }),
  unit({ id: 'clone', name: 'Clone Spell', kind: 'spell', resource: 'elixir', housing: 3,
    max: { 10: 2, 11: 3, 13: 5, 15: 6, 17: 7 },
    costs: { 2: 3000000, 4: 8000000, 7: 13000000 }, times: { 2: 96, 4: 204, 7: 288 } }),
  unit({ id: 'invisibility', name: 'Invisibility Spell', kind: 'spell', resource: 'elixir', housing: 1,
    max: { 12: 2, 14: 3, 16: 4 },
    costs: { 2: 5000000, 4: 12500000 }, times: { 2: 144, 4: 276 } }),
  unit({ id: 'recall', name: 'Recall Spell', kind: 'spell', resource: 'elixir', housing: 2,
    max: { 13: 2, 15: 3, 17: 4 },
    costs: { 2: 7000000, 4: 13500000 }, times: { 2: 180, 4: 300 } }),
  unit({ id: 'revive', name: 'Revive Spell', kind: 'spell', resource: 'elixir', housing: 1,
    max: { 16: 2, 17: 3 },
    costs: { 2: 12000000, 3: 15000000 }, times: { 2: 276, 3: 336 } }),
  unit({ id: 'poison', name: 'Poison Spell', kind: 'spell', resource: 'dark', housing: 1,
    max: { 8: 2, 9: 3, 10: 4, 11: 5, 12: 6, 13: 7, 14: 8, 15: 9, 16: 10, 17: 11 },
    costs: { 2: 40000, 6: 150000, 11: 400000 }, times: { 2: 24, 6: 120, 11: 288 } }),
  unit({ id: 'earthquake', name: 'Earthquake Spell', kind: 'spell', resource: 'dark', housing: 1,
    max: { 8: 2, 9: 3, 11: 4, 13: 5 },
    costs: { 2: 60000, 5: 300000 }, times: { 2: 36, 5: 216 } }),
  unit({ id: 'haste', name: 'Haste Spell', kind: 'spell', resource: 'dark', housing: 1,
    max: { 9: 2, 10: 3, 12: 4, 14: 5 },
    costs: { 2: 70000, 5: 320000 }, times: { 2: 48, 5: 228 } }),
  unit({ id: 'skeleton', name: 'Skeleton Spell', kind: 'spell', resource: 'dark', housing: 1,
    max: { 10: 2, 11: 4, 13: 6, 15: 7, 17: 8 },
    costs: { 2: 80000, 5: 280000, 8: 420000 }, times: { 2: 60, 5: 204, 8: 300 } }),
  unit({ id: 'bat', name: 'Bat Spell', kind: 'spell', resource: 'dark', housing: 1,
    max: { 11: 2, 12: 3, 13: 4, 14: 5, 16: 6 },
    costs: { 2: 100000, 6: 400000 }, times: { 2: 72, 6: 288 } }),
];

/** Siege machines (Workshop + Laboratory). */
export const SIEGES = [
  unit({ id: 'wall_wrecker', name: 'Wall Wrecker', kind: 'siege', resource: 'elixir', housing: 1,
    max: { 12: 2, 13: 3, 14: 4, 16: 5 },
    costs: { 2: 6000000, 5: 13000000 }, times: { 2: 168, 5: 300 } }),
  unit({ id: 'battle_blimp', name: 'Battle Blimp', kind: 'siege', resource: 'elixir', housing: 1,
    max: { 12: 2, 13: 3, 14: 4, 16: 5 },
    costs: { 2: 6000000, 5: 13000000 }, times: { 2: 168, 5: 300 } }),
  unit({ id: 'stone_slammer', name: 'Stone Slammer', kind: 'siege', resource: 'elixir', housing: 1,
    max: { 12: 2, 13: 3, 15: 4 },
    costs: { 2: 7000000, 4: 13000000 }, times: { 2: 180, 4: 300 } }),
  unit({ id: 'siege_barracks', name: 'Siege Barracks', kind: 'siege', resource: 'elixir', housing: 1,
    max: { 13: 2, 14: 3, 16: 4 },
    costs: { 2: 8000000, 4: 13500000 }, times: { 2: 192, 4: 300 } }),
  unit({ id: 'log_launcher', name: 'Log Launcher', kind: 'siege', resource: 'elixir', housing: 1,
    max: { 13: 2, 15: 3, 17: 4 },
    costs: { 2: 9000000, 4: 14000000 }, times: { 2: 204, 4: 312 } }),
  unit({ id: 'flame_flinger', name: 'Flame Flinger', kind: 'siege', resource: 'elixir', housing: 1,
    max: { 14: 2, 16: 3 },
    costs: { 2: 10000000, 3: 14000000 }, times: { 2: 216, 3: 312 } }),
  unit({ id: 'battle_drill', name: 'Battle Drill', kind: 'siege', resource: 'elixir', housing: 1,
    max: { 15: 2, 17: 3 },
    costs: { 2: 11000000, 3: 14500000 }, times: { 2: 240, 3: 324 } }),
  unit({ id: 'troop_launcher', name: 'Troop Launcher', kind: 'siege', resource: 'elixir', housing: 1,
    max: { 16: 2, 17: 3 },
    costs: { 2: 12500000, 3: 15000000 }, times: { 2: 276, 3: 336 } }),
];

/** Heroes (Hero Hall / altars — upgraded outside the Laboratory, one at a time). */
export const HEROES = [
  unit({ id: 'barbarian_king', name: 'Barbarian King', kind: 'hero', resource: 'dark', housing: 0,
    max: { 7: 5, 8: 10, 9: 30, 10: 40, 11: 50, 12: 65, 13: 75, 14: 80, 15: 90, 16: 95, 17: 100 },
    costs: { 2: 10000, 20: 60000, 40: 130000, 60: 210000, 80: 290000, 100: 400000 },
    times: { 2: 12, 20: 84, 40: 156, 60: 204, 80: 252, 100: 312 } }),
  unit({ id: 'archer_queen', name: 'Archer Queen', kind: 'hero', resource: 'dark', housing: 0,
    max: { 9: 30, 10: 40, 11: 50, 12: 65, 13: 75, 14: 80, 15: 90, 16: 95, 17: 100 },
    costs: { 2: 12000, 20: 65000, 40: 140000, 60: 220000, 80: 300000, 100: 410000 },
    times: { 2: 12, 20: 90, 40: 162, 60: 210, 80: 258, 100: 312 } }),
  unit({ id: 'minion_prince', name: 'Minion Prince', kind: 'hero', resource: 'dark', housing: 0,
    max: { 9: 20, 10: 30, 11: 40, 12: 50, 13: 60, 14: 65, 15: 75, 16: 85, 17: 90 },
    costs: { 2: 12000, 20: 70000, 45: 160000, 70: 260000, 90: 380000 },
    times: { 2: 12, 20: 90, 45: 168, 70: 228, 90: 300 } }),
  unit({ id: 'grand_warden', name: 'Grand Warden', kind: 'hero', resource: 'elixir', housing: 0,
    max: { 11: 20, 12: 40, 13: 50, 14: 55, 15: 65, 16: 70, 17: 75 },
    costs: { 2: 3000000, 20: 7000000, 40: 11000000, 60: 14500000, 75: 17000000 },
    times: { 2: 24, 20: 120, 40: 192, 60: 252, 75: 300 } }),
  unit({ id: 'royal_champion', name: 'Royal Champion', kind: 'hero', resource: 'dark', housing: 0,
    max: { 13: 25, 14: 30, 15: 40, 16: 45, 17: 50 },
    costs: { 2: 60000, 15: 140000, 30: 250000, 50: 400000 },
    times: { 2: 60, 15: 132, 30: 204, 50: 300 } }),
];

/** Hero pets (Pet House). */
export const PETS = [
  unit({ id: 'lassi', name: 'L.A.S.S.I', kind: 'pet', resource: 'dark', housing: 0,
    max: { 14: 10, 15: 15, 16: 20, 17: 25 },
    costs: { 1: 115000, 10: 220000, 25: 400000 }, times: { 1: 96, 10: 168, 25: 288 } }),
  unit({ id: 'electro_owl', name: 'Electro Owl', kind: 'pet', resource: 'dark', housing: 0,
    max: { 14: 10, 15: 15, 16: 20, 17: 25 },
    costs: { 1: 125000, 10: 230000, 25: 405000 }, times: { 1: 108, 10: 174, 25: 288 } }),
  unit({ id: 'mighty_yak', name: 'Mighty Yak', kind: 'pet', resource: 'dark', housing: 0,
    max: { 14: 10, 15: 15, 16: 20, 17: 25 },
    costs: { 1: 135000, 10: 240000, 25: 410000 }, times: { 1: 120, 10: 180, 25: 288 } }),
  unit({ id: 'unicorn', name: 'Unicorn', kind: 'pet', resource: 'dark', housing: 0,
    max: { 14: 10, 15: 15, 16: 20, 17: 25 },
    costs: { 1: 145000, 10: 250000, 25: 415000 }, times: { 1: 132, 10: 186, 25: 288 } }),
  unit({ id: 'frosty', name: 'Frosty', kind: 'pet', resource: 'dark', housing: 0,
    max: { 15: 10, 16: 15, 17: 20 },
    costs: { 1: 175000, 10: 280000, 20: 400000 }, times: { 1: 144, 10: 204, 20: 288 } }),
  unit({ id: 'diggy', name: 'Diggy', kind: 'pet', resource: 'dark', housing: 0,
    max: { 15: 10, 16: 15, 17: 20 },
    costs: { 1: 185000, 10: 290000, 20: 405000 }, times: { 1: 150, 10: 210, 20: 288 } }),
  unit({ id: 'poison_lizard', name: 'Poison Lizard', kind: 'pet', resource: 'dark', housing: 0,
    max: { 15: 10, 16: 15, 17: 20 },
    costs: { 1: 195000, 10: 300000, 20: 410000 }, times: { 1: 156, 10: 216, 20: 288 } }),
  unit({ id: 'phoenix', name: 'Phoenix', kind: 'pet', resource: 'dark', housing: 0,
    max: { 15: 10, 16: 15, 17: 20 },
    costs: { 1: 205000, 10: 310000, 20: 415000 }, times: { 1: 162, 10: 222, 20: 288 } }),
  unit({ id: 'spirit_fox', name: 'Spirit Fox', kind: 'pet', resource: 'dark', housing: 0,
    max: { 16: 10, 17: 15 },
    costs: { 1: 240000, 15: 420000 }, times: { 1: 192, 15: 300 } }),
  unit({ id: 'angry_jelly', name: 'Angry Jelly', kind: 'pet', resource: 'dark', housing: 0,
    max: { 16: 10, 17: 15 },
    costs: { 1: 250000, 15: 425000 }, times: { 1: 198, 15: 300 } }),
];

export const ALL_UNITS = [...TROOPS, ...DARK_TROOPS, ...SPELLS, ...SIEGES, ...HEROES, ...PETS];
export const UNITS_BY_ID = Object.fromEntries(ALL_UNITS.map((u) => [u.id, u]));

/** Everything unlocked at a Town Hall, with the max level reachable there. */
export function unitsAtTH(th) {
  return ALL_UNITS.filter((u) => u.max[th] > 0).map((u) => ({ ...u, maxHere: u.max[th] }));
}

/** Army camp capacity by Town Hall — used by the army composer. */
export const CAMP_CAPACITY = [0, 20, 30, 70, 80, 135, 150, 200, 200, 220, 240, 260, 280, 300, 300, 320, 320, 340];
export const SPELL_CAPACITY = [0, 0, 0, 0, 0, 2, 2, 4, 6, 7, 9, 11, 11, 11, 11, 11, 11, 11];
