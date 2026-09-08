import { describe, expect, it } from 'vitest';
import { MAX_TH, TOWN_HALLS } from '../town-halls';
import { BUILDINGS, BUILDINGS_BY_ID, SUPERCHARGES } from '../buildings';
import { ALL_UNITS } from '../army';

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
  it('no Home Village building level is interpolated', () => {
    // Every one of these is read from that structure's own published table.
    // A single `est` here means someone reintroduced a curve.
    const guessed = BUILDINGS.flatMap((b) =>
      b.levels.map((l, i) => (l?.est ? `${b.id} lvl${i}` : null)).filter(Boolean));
    expect(guessed).toEqual([]);
  });

  it('reports how much of the dataset is interpolated', () => {
    const all = [...BUILDINGS, ...ALL_UNITS];
    const total = all.reduce((n, x) => n + x.maxLevel, 0);
    const est = all.reduce((n, x) => n + x.levels.filter((l) => l?.est).length, 0);
    // Guard-rail, not a target: if this jumps, someone deleted anchors. What is
    // left is `army.ts` — troops, spells and heroes are still on anchors.
    expect(est / total).toBeLessThan(0.6);
    console.log(`dataset: ${total} levels, ${total - est} anchored, ${est} interpolated`);
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
