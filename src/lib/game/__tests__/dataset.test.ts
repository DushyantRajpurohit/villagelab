import { describe, expect, it } from 'vitest';
import { MAX_TH, TOWN_HALLS } from '../town-halls';
import { BUILDINGS, BUILDINGS_BY_ID, SUPERCHARGES } from '../buildings';
import { ALL_UNITS, CAMP_CAPACITY, SPELL_CAPACITY, UNITS_BY_ID } from '../army';
import {
  EQUIPMENT, EQUIPMENT_BY_ID, ORES, addOre, equipmentForHero, oreToMax, totalOre,
} from '../equipment';

/**
 * These do not verify values against the wiki — they catch the mistakes that
 * are easy to make while correcting curated data: a max level that goes
 * backwards, a count that drops at a higher Town Hall, a unit that unlocks
 * before the building which produces it.
 */

const nonDecreasing = (arr: number[], label: string) => {
  for (let th = 2; th <= MAX_TH; th++) {
    expect(arr[th], `${label} drops from TH${th - 1} to TH${th}`).toBeGreaterThanOrEqual(arr[th - 1]);
  }
};

describe('town halls', () => {
  it('cost and build time never go backwards', () => {
    for (let th = 2; th <= MAX_TH; th++) {
      expect(TOWN_HALLS[th]!.cost).toBeGreaterThan(TOWN_HALLS[th - 1]!.cost);
      expect(TOWN_HALLS[th]!.hours).toBeGreaterThanOrEqual(TOWN_HALLS[th - 1]!.hours);
    }
  });
});

/**
 * The Eagle Artillery merges into the Town Hall's Giga Inferno at Town Hall 17
 * and is permanently gone, so its count is the one that legitimately falls.
 * Merging pairs of defences (Cannons into a Ricochet Cannon, and so on) does
 * *not* belong here: `count` records the un-merged figure precisely so that a
 * merged building still shows the upgrades you have to pay for first.
 */
const COUNT_MAY_FALL = new Set(['eagle_artillery']);

describe.each(BUILDINGS.map((b) => [b.name, b] as const))('building: %s', (_name, b) => {
  it('count and max level never decrease with Town Hall', () => {
    if (!COUNT_MAY_FALL.has(b.id)) nonDecreasing(b.count, `${b.name} count`);
    nonDecreasing(b.max, `${b.name} max`);
  });

  it('has a dense level table matching its max level', () => {
    expect(b.maxLevel).toBe(Math.max(...b.max));
    expect(b.levels).toHaveLength(b.maxLevel + 1);
    for (let l = 1; l <= b.maxLevel; l++) expect(b.levels[l]).not.toBeNull();
  });

  it('costs increase with level', () => {
    for (let l = 2; l <= b.maxLevel; l++) {
      expect(b.levels[l]!.cost).toBeGreaterThanOrEqual(b.levels[l - 1]!.cost);
    }
  });
});

describe.each(ALL_UNITS.map((u) => [u.name, u] as const))('unit: %s', (_name, u) => {
  it('max level never decreases with Town Hall', () => nonDecreasing(u.max, `${u.name} max`));

  it('has a dense level table and increasing costs', () => {
    expect(u.levels).toHaveLength(u.maxLevel + 1);
    for (let l = 2; l <= u.maxLevel; l++) {
      expect(u.levels[l]!.cost).toBeGreaterThanOrEqual(u.levels[l - 1]!.cost);
    }
  });

  it('does not unlock before the building that produces it', () => {
    const dep =
      u.kind === 'troop' && u.resource === 'dark' ? 'dark_barracks'
      : u.kind === 'spell' && u.resource === 'dark' ? 'dark_spell_factory'
      : u.kind === 'troop' ? 'barracks'
      : u.kind === 'spell' ? 'spell_factory'
      : u.kind === 'siege' ? 'workshop'
      : u.kind === 'pet' ? 'pet_house'
      : null;
    if (!dep) return;
    expect(u.unlockTH).toBeGreaterThanOrEqual(BUILDINGS_BY_ID[dep].unlockTH);
  });
});

describe('estimate coverage', () => {
  it('nothing in the dataset is interpolated', () => {
    // Every level in both villages is read from that entity's own published
    // table. A single `est` here means someone reintroduced a curve — which is
    // what put a level 21 Cannon at 7.5x its real price and the Lava Hound's
    // cost-to-max at 158% over.
    const all = [...BUILDINGS, ...ALL_UNITS];
    const guessed = all.flatMap((x) =>
      x.levels.map((l, i) => (l?.est ? `${x.id} lvl${i}` : null)).filter(Boolean));
    expect(guessed).toEqual([]);
    const total = all.reduce((n, x) => n + x.maxLevel, 0);
    console.log(`dataset: ${total} levels, all anchored`);
  });
});

describe('units', () => {
  it('does not unlock anything before its producing building exists', () => {
    // The level table's first row is free and names no Laboratory level, so
    // deriving the unlock from it put the Dragon at Town Hall 1.
    expect(UNITS_BY_ID.dragon.unlockTH).toBe(7);
    expect(UNITS_BY_ID.electro_titan.unlockTH).toBe(14);
    expect(UNITS_BY_ID.barbarian.unlockTH).toBe(1);
    for (const u of ALL_UNITS) {
      expect(u.unlockTH, `${u.name} unlock`).toBeGreaterThan(0);
      expect(u.max[u.unlockTH], `${u.name} has no level at its unlock`).toBeGreaterThan(0);
    }
  });

  it('holds values read off the wiki, not off a curve', () => {
    // The Witch was listed at 10 levels against a real 8, and the Barbarian
    // King's cost-to-max was 44% over.
    expect(UNITS_BY_ID.witch.maxLevel).toBe(8);
    expect(UNITS_BY_ID.healer.maxLevel).toBe(11);
    const bk = UNITS_BY_ID.barbarian_king.levels.reduce((n, l) => n + (l?.cost ?? 0), 0);
    expect(bk).toBe(15_211_500);
    // A hero is bought, not handed over: the Grand Warden's level 1 is priced.
    expect(UNITS_BY_ID.grand_warden.levels[1]!.cost).toBe(1_000_000);
    // Everything else starts free.
    expect(UNITS_BY_ID.barbarian.levels[1]!.cost).toBe(0);
  });

  it('has camp and spell capacity through the top hall', () => {
    // Both were hand-written arrays that stopped at Town Hall 17.
    expect(CAMP_CAPACITY[MAX_TH]).toBe(352);
    expect(SPELL_CAPACITY[MAX_TH]).toBe(11);
    for (let th = 2; th <= MAX_TH; th++) {
      expect(CAMP_CAPACITY[th], `camp capacity TH${th}`).toBeGreaterThanOrEqual(CAMP_CAPACITY[th - 1]);
      expect(SPELL_CAPACITY[th], `spell capacity TH${th}`).toBeGreaterThanOrEqual(SPELL_CAPACITY[th - 1]);
    }
  });
});

describe('town hall 18', () => {
  it('every structure has a count and a ceiling there', () => {
    for (const b of BUILDINGS) {
      expect(b.count[MAX_TH], `${b.name} count at TH${MAX_TH}`).toBeGreaterThanOrEqual(0);
      expect(b.max[MAX_TH], `${b.name} ceiling at TH${MAX_TH}`).toBeGreaterThanOrEqual(0);
      if (b.count[MAX_TH] > 0) expect(b.max[MAX_TH]).toBeGreaterThan(0);
    }
  });

  it('has the structures that arrive with it', () => {
    for (const id of ['revenge_tower', 'super_wizard_tower']) {
      expect(BUILDINGS_BY_ID[id]?.unlockTH, id).toBe(18);
    }
  });

  it('keeps the Eagle Artillery out of a Town Hall 17 village', () => {
    // It merges into the Giga Inferno and does not come back.
    const eagle = BUILDINGS_BY_ID.eagle_artillery;
    expect(eagle.count[16]).toBe(1);
    expect(eagle.count[17]).toBe(0);
    expect(eagle.count[18]).toBe(0);
  });

  it('holds values read off the wiki, not off a curve', () => {
    // Spot checks against the published tables. The old anchors put a level 21
    // Cannon at 22,500,000 gold; it is 3,000,000.
    expect(BUILDINGS_BY_ID.cannon.levels[21]!.cost).toBe(3_000_000);
    expect(BUILDINGS_BY_ID.wall.levels[19]!.cost).toBe(10_000_000);
    expect(BUILDINGS_BY_ID.wall.max[MAX_TH]).toBe(19);
    expect(BUILDINGS_BY_ID.builders_hut.levels[8]!.cost).toBe(24_000_000);
    expect(BUILDINGS_BY_ID.monolith.resource).toBe('dark');
    expect(BUILDINGS_BY_ID.clan_castle.resource).toBe('elixir');
  });
});

describe('supercharges', () => {
  it('sit outside the normal level track', () => {
    for (const [id, charges] of Object.entries(SUPERCHARGES)) {
      const b = BUILDINGS_BY_ID[id];
      expect(b, id).toBeDefined();
      expect(charges.length).toBeGreaterThan(0);
      // They are extra levels on a maxed building, so they must not have been
      // folded into `levels` — that would overstate what maxing costs.
      expect(b.levels).toHaveLength(b.maxLevel + 1);
      for (const c of charges) expect(c.est).toBe(false);
    }
  });

  it('only applies to structures a Town Hall 18 village still has', () => {
    for (const id of Object.keys(SUPERCHARGES)) {
      expect(BUILDINGS_BY_ID[id].count[MAX_TH], id).toBeGreaterThan(0);
    }
  });
});

describe('town hall 18 and the sixth hero', () => {
  it('runs to Town Hall 18', () => {
    expect(MAX_TH).toBe(18);
    expect(TOWN_HALLS[18]).toBeTruthy();
    expect(TOWN_HALLS[18]!.cost).toBeGreaterThan(TOWN_HALLS[17]!.cost);
  });

  it('has no estimated Town Hall left', () => {
    // Every level is now transcribed from the game's own table. The old
    // curated guesses had TH17 at 528 hours against a real 240 — a geometric
    // guess that kept doubling where the game had flattened out.
    for (let th = 1; th <= MAX_TH; th++) {
      expect(TOWN_HALLS[th]!.verified, `TH${th}`).toBe(true);
    }
  });

  it('gives every hero a ceiling at Town Hall 18', () => {
    const heroes = ALL_UNITS.filter((u) => u.kind === 'hero');
    expect(heroes).toHaveLength(6);
    for (const h of heroes) {
      expect(h.max[18], h.id).toBeGreaterThan(0);
      expect(h.max[18], h.id).toBeGreaterThanOrEqual(h.max[17]);
    }
  });

  it('unlocks the Dragon Duke at Town Hall 15, not 18', () => {
    // The newest hero, but not a Town Hall 18 exclusive — the Hero Hall level
    // that unlocks it is reachable at TH15.
    const dd = ALL_UNITS.find((u) => u.id === 'dragon_duke')!;
    expect(dd.kind).toBe('hero');
    expect(dd.unlockTH).toBe(15);
    expect(dd.max[14]).toBe(0);
    expect(dd.max[18]).toBe(25);
  });
});

describe.each(EQUIPMENT.map((e) => [e.name, e] as const))('equipment: %s', (_name, e) => {
  it('max level never decreases with Town Hall', () => nonDecreasing(e.max, `${e.name} max`));

  it('has a dense level table and a Blacksmith gate that never falls', () => {
    expect(e.maxLevel).toBe(Math.max(...e.max));
    expect(e.levels).toHaveLength(e.maxLevel + 1);
    for (let l = 1; l <= e.maxLevel; l++) expect(e.levels[l]).not.toBeNull();
    for (let l = 2; l <= e.maxLevel; l++) {
      expect(e.levels[l]!.gate).toBeGreaterThanOrEqual(e.levels[l - 1]!.gate);
    }
  });

  it('is free at level 1 and costs ore at every level after', () => {
    // Equipment arrives at level 1; you never buy that level.
    expect(totalOre(e.levels[1]!.ore)).toBe(0);
    for (let l = 2; l <= e.maxLevel; l++) {
      expect(totalOre(e.levels[l]!.ore), `${e.id} lvl${l}`).toBeGreaterThan(0);
    }
  });

  it('does not exist before the Blacksmith or before its hero', () => {
    expect(e.unlockTH).toBeGreaterThanOrEqual(UNITS_BY_ID[e.hero].unlockTH);
    // Level 1 of an item that names a Blacksmith level needs one to be built.
    if (e.levels[1]!.gate > 0) {
      expect(e.unlockTH).toBeGreaterThanOrEqual(BUILDINGS_BY_ID.blacksmith.unlockTH);
    }
  });
});

describe('hero equipment', () => {
  it('covers all 42 items across the six heroes', () => {
    expect(EQUIPMENT).toHaveLength(42);
    const heroes = new Set(EQUIPMENT.map((e) => e.hero));
    expect(heroes.size).toBe(6);
    for (const h of heroes) expect(UNITS_BY_ID[h]?.kind, h).toBe('hero');
  });

  it('prices every item of a rarity identically, bar one published outlier', () => {
    // The game charges by rarity, not by item, so 41 of the 42 agreeing to the
    // ore is the strongest check we have that the per-page transcription did
    // not drift.
    //
    // The exception is the Stun Blaster, whose page prices level 6 at 940 Shiny
    // where the other 23 commons all say 840 — every other row in its column
    // matches. It reads like a typo at the source, but this dataset transcribes
    // what is published rather than what it expects, so the figure stands and
    // is pinned here instead of being quietly rounded to the pattern.
    const toMax = (e: (typeof EQUIPMENT)[number]) =>
      JSON.stringify(addOre(...e.levels.slice(1).map((l) => l!.ore)));

    const common = EQUIPMENT.filter((e) => e.rarity === 'common');
    const epic = EQUIPMENT.filter((e) => e.rarity === 'epic');
    expect(common).toHaveLength(24);
    expect(epic).toHaveLength(18);

    const odd = common.filter((e) => toMax(e) !== toMax(EQUIPMENT_BY_ID.barbarian_puppet));
    expect(odd.map((e) => e.id)).toEqual(['stun_blaster']);
    expect(JSON.parse(toMax(EQUIPMENT_BY_ID.stun_blaster)))
      .toEqual({ shiny: 27_360, glowy: 1_920 });
    expect(EQUIPMENT_BY_ID.stun_blaster.levels[6]!.ore.shiny).toBe(940);
    expect(EQUIPMENT_BY_ID.barbarian_puppet.levels[6]!.ore.shiny).toBe(840);

    expect(new Set(epic.map(toMax)).size).toBe(1);
    expect(JSON.parse(toMax(common[0]))).toEqual({ shiny: 27_260, glowy: 1_920 });
    expect(JSON.parse(toMax(epic[0]))).toEqual({ shiny: 56_060, glowy: 3_720, starry: 480 });
  });

  it('gives commons 18 levels and epics 27', () => {
    for (const e of EQUIPMENT) {
      expect(e.maxLevel, e.id).toBe(e.rarity === 'common' ? 18 : 27);
    }
  });

  it('never uses Starry Ore on a common item', () => {
    // Starry Ore only ever appears on epic upgrades.
    for (const e of EQUIPMENT.filter((x) => x.rarity === 'common')) {
      for (const l of e.levels) expect(l?.ore.starry, e.id).toBeUndefined();
    }
    expect(ORES).toEqual(['shiny', 'glowy', 'starry']);
  });

  it('spends nothing to max an item already at its ceiling', () => {
    const g = EQUIPMENT_BY_ID.giant_gauntlet;
    expect(totalOre(oreToMax(g, g.max[MAX_TH], MAX_TH))).toBe(0);
    expect(oreToMax(g, 1, MAX_TH)).toEqual({ shiny: 56_060, glowy: 3_720, starry: 480 });
  });

  it('hands the Barbarian King his puppet at Town Hall 4, with the Hero Hall', () => {
    // The Barbarian Puppet is not bought — it comes with the hero, so it can
    // exist before the Blacksmith does.
    const bp = EQUIPMENT_BY_ID.barbarian_puppet;
    expect(bp.unlockTH).toBe(4);
    expect(bp.levels[1]!.gate).toBe(0);
    expect(BUILDINGS_BY_ID.hero_hall.unlockTH).toBe(4);
  });

  it('groups a hero\'s items commons first', () => {
    const bk = equipmentForHero('barbarian_king');
    expect(bk.length).toBeGreaterThan(4);
    const firstEpic = bk.findIndex((e) => e.rarity === 'epic');
    expect(bk.slice(0, firstEpic).every((e) => e.rarity === 'common')).toBe(true);
    expect(bk.slice(firstEpic).every((e) => e.rarity === 'epic')).toBe(true);
  });
});

describe('the Hero Hall', () => {
  it('is a structure like any other, not just a mapping', () => {
    // It was used to derive every hero's ceiling long before it was added to
    // the building table, which left the village drawing a hall it did not own.
    const hh = BUILDINGS_BY_ID.hero_hall;
    expect(hh).toBeTruthy();
    expect(hh.maxLevel).toBe(12);
    expect(hh.count[MAX_TH]).toBe(1);
    expect(hh.resource).toBe('elixir');
    expect(hh.levels[12]!.cost).toBe(26_000_000);
  });

  it('agrees with the hero ceilings it was used to derive', () => {
    // Hero Hall level N is reachable at exactly the Town Hall where each hero's
    // ceiling steps up; a mismatch means one of the two was re-scraped alone.
    const hh = BUILDINGS_BY_ID.hero_hall;
    expect(hh.max[4]).toBe(1);
    expect(hh.max[8]).toBe(2);
    expect(hh.max[MAX_TH]).toBe(12);
    expect(UNITS_BY_ID.archer_queen.unlockTH).toBe(8);
  });
});
