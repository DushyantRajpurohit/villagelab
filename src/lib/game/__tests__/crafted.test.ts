import { describe, expect, it } from 'vitest';
import {
  CRAFTED_DEFENSES, CRAFTED_BY_ID, CRAFTING_PHASE, CRAFTING_STATION_ID,
  craftedAtTH, craftedCostToMax, moduleCostToMax, phaseCostToMax, phaseHasEnded,
} from '../crafted';
import {
  PER_CHARGE_LEVEL, PER_MODULE_LEVEL, SPARKY_CAP,
  sparkyAtTH, sparkyFromDefense, sparkyFromPhase, sparkyFromSupercharges,
} from '../sparky';
import { BUILDINGS_BY_ID, SUPERCHARGES } from '../buildings';
import { MAX_TH } from '../town-halls';
import type { Resource } from '../types';

/**
 * The Crafted Defense tables are unusually self-checking, and these pin the
 * checks rather than the individual figures.
 *
 * The game builds all three defenses out of the same three module "slots" —
 * three build-time ladders and three cost ladders — permuted so that no two
 * defenses spend the same currency on the same slot. The Crafting Station page
 * publishes the slot durations and the Sparky Stone payouts independently of
 * the per-level tables these numbers were read from, so both sides have to
 * agree for the transcription to be right. They are the strongest check
 * available here, the way the uniform ore price is for hero equipment.
 */

const RESOURCES: Resource[] = ['gold', 'elixir', 'dark'];

/** Season 4's published module durations: 20d20h, 22d15h and 24d2h. */
const SLOT_HOURS = [500, 543, 578];

const moduleHours = (levels: ({ hours: number } | null)[]) =>
  levels.reduce((a, l) => a + (l?.hours ?? 0), 0);

describe('crafting phase', () => {
  it('records which phase it holds and when that ends', () => {
    expect(CRAFTING_PHASE.number).toBeGreaterThan(0);
    expect(CRAFTING_PHASE.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(CRAFTING_PHASE.until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(CRAFTING_PHASE.until) > new Date(CRAFTING_PHASE.from)).toBe(true);
  });

  it('reports the phase as over only after its last day', () => {
    // Not asserted against the real clock anywhere: a test that starts failing
    // on a date nobody touched the code is a time bomb, not a check. The UI
    // reads the date and says what it finds, and this pins the comparison.
    expect(phaseHasEnded(new Date(`${CRAFTING_PHASE.until}T12:00:00Z`))).toBe(false);
    expect(phaseHasEnded(new Date(`${CRAFTING_PHASE.from}T00:00:00Z`))).toBe(false);
    const after = new Date(`${CRAFTING_PHASE.until}T23:59:59Z`);
    after.setUTCDate(after.getUTCDate() + 1);
    expect(phaseHasEnded(after)).toBe(true);
  });

  it('hosts them in a structure the village can actually own', () => {
    // The Crafting Station is a real Building; the defenses are not. If the two
    // ever disagree about the Town Hall, one of them has been re-scraped alone.
    const station = BUILDINGS_BY_ID[CRAFTING_STATION_ID];
    expect(station).toBeDefined();
    expect(station.unlockTH).toBe(CRAFTED_DEFENSES[0].unlockTH);
    for (const d of CRAFTED_DEFENSES) expect(d.unlockTH).toBe(station.unlockTH);
  });

  it('is free and level-less, because the defense carries the levels', () => {
    const station = BUILDINGS_BY_ID[CRAFTING_STATION_ID];
    expect(station.maxLevel).toBe(1);
    expect(station.levels[1]!.cost).toBe(0);
    expect(station.levels[1]!.hours).toBe(0);
  });
});

describe.each(CRAFTED_DEFENSES.map((d) => [d.name, d] as const))('crafted: %s', (_name, d) => {
  it('has exactly three modules of ten levels', () => {
    expect(d.modules).toHaveLength(3);
    for (const m of d.modules) {
      expect(m.maxLevel).toBe(10);
      expect(m.levels).toHaveLength(11);
    }
    expect(d.maxLevel).toBe(30);
  });

  it('arrives at level 3 and tops out at 30', () => {
    // The defense's own level is its modules' summed, so it is never below 3
    // anywhere it exists and reaches 30 only at the top hall.
    expect(d.max[d.unlockTH]).toBe(3);
    expect(d.max[MAX_TH]).toBe(30);
  });

  it('leaves level 1 unpriced, because it is where a module starts', () => {
    for (const m of d.modules) {
      expect(m.levels[1]).toBeNull();
      for (let l = 2; l <= 10; l++) expect(m.levels[l], `${m.name} L${l}`).not.toBeNull();
    }
  });

  it('spends a different currency on each of its three modules', () => {
    // One Crafted Defense is billed in gold *and* elixir *and* dark elixir,
    // which is why `resource` sits on the module rather than the defense.
    expect(new Set(d.modules.map((m) => m.resource)).size).toBe(3);
  });

  it('never lets a ceiling or a cost go backwards', () => {
    for (const m of d.modules) {
      for (let th = 2; th <= MAX_TH; th++) {
        expect(m.max[th], `${m.name} max drops at TH${th}`).toBeGreaterThanOrEqual(m.max[th - 1]);
      }
      for (let l = 3; l <= 10; l++) {
        expect(m.levels[l]!.cost, `${m.name} L${l} cost`)
          .toBeGreaterThan(m.levels[l - 1]!.cost);
        expect(m.levels[l]!.hours, `${m.name} L${l} hours`)
          .toBeGreaterThan(m.levels[l - 1]!.hours);
      }
    }
  });

  it('takes 67 days and 13 hours to max, in three published slots', () => {
    // The Crafting Station page states the Season 4 module durations and their
    // total independently of the per-level tables these were read from.
    expect(d.modules.map((m) => moduleHours(m.levels)).sort((a, b) => a - b))
      .toEqual(SLOT_HOURS);
    expect(craftedCostToMax(d, MAX_TH).hours).toBe(1621);
  });

  it('pays 216 Sparky Stones to take to the maximum', () => {
    // 27 purchasable module levels at 8 each — the figure the Crafting Station
    // page publishes, and it only falls out if the tables have the right number
    // of rows.
    expect(craftedCostToMax(d, MAX_TH).levels).toBe(27);
    expect(sparkyFromDefense(d, MAX_TH)).toBe(216);
  });

  it('costs nothing and takes no time at a hall below the Crafting Station', () => {
    const below = craftedCostToMax(d, d.unlockTH - 1);
    expect(below.hours).toBe(0);
    expect(below.levels).toBe(0);
    for (const k of RESOURCES) expect(below.cost[k]).toBe(0);
  });
});

describe('the phase as a set', () => {
  it('builds every defense from the same three slots, permuted', () => {
    // No two defenses spend the same currency on the same duration slot, and
    // between them the three cover every pairing. That is what makes the set
    // symmetric, and it is the check that would catch a module transcribed onto
    // the wrong defense.
    const pairs = CRAFTED_DEFENSES.flatMap((d) =>
      d.modules.map((m) => `${m.resource}@${moduleHours(m.levels)}`));
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(pairs).toHaveLength(9);
  });

  it('prices gold and elixir identically across the whole phase', () => {
    // Each currency lands on each duration slot exactly once, so the set costs
    // the same gold as elixir even though no single defense does.
    const total = phaseCostToMax(MAX_TH);
    expect(total.cost.gold).toBe(total.cost.elixir);
    expect(total.cost.dark).toBeGreaterThan(0);
    expect(total.cost.dark).toBeLessThan(total.cost.gold);
  });

  it('pays 648 Sparky Stones for all three', () => {
    expect(sparkyFromPhase(MAX_TH)).toBe(648);
    expect(phaseCostToMax(MAX_TH).levels).toBe(81);
  });

  it('offers nothing below the Crafting Station and all three at it', () => {
    const unlock = CRAFTED_DEFENSES[0].unlockTH;
    expect(craftedAtTH(unlock - 1)).toHaveLength(0);
    expect(craftedAtTH(unlock)).toHaveLength(CRAFTED_DEFENSES.length);
    expect(craftedAtTH(MAX_TH)).toHaveLength(CRAFTED_DEFENSES.length);
  });

  it('reports each defense\'s ceiling at the hall asked for', () => {
    for (const d of craftedAtTH(MAX_TH)) expect(d.maxHere).toBe(30);
    for (const d of craftedAtTH(CRAFTED_DEFENSES[0].unlockTH)) expect(d.maxHere).toBe(3);
  });

  it('indexes every defense by id', () => {
    for (const d of CRAFTED_DEFENSES) expect(CRAFTED_BY_ID[d.id]).toBe(d);
  });
});

describe('module costs', () => {
  const hotCandle = CRAFTED_DEFENSES[0];

  it('charges only for the levels above the one you are at', () => {
    const m = hotCandle.modules[0];
    const all = moduleCostToMax(m, 1, MAX_TH);
    const half = moduleCostToMax(m, 5, MAX_TH);
    expect(all.levels).toBe(9);
    expect(half.levels).toBe(5);
    expect(half.cost[m.resource]).toBeLessThan(all.cost[m.resource]);
  });

  it('charges nothing for a module already at its ceiling', () => {
    const m = hotCandle.modules[0];
    const done = moduleCostToMax(m, m.max[MAX_TH], MAX_TH);
    expect(done.levels).toBe(0);
    expect(done.hours).toBe(0);
    for (const k of RESOURCES) expect(done.cost[k]).toBe(0);
  });

  it('puts a module\'s whole bill in its own currency and no other', () => {
    for (const m of hotCandle.modules) {
      const c = moduleCostToMax(m, 1, MAX_TH);
      for (const k of RESOURCES) {
        if (k === m.resource) expect(c.cost[k]).toBeGreaterThan(0);
        else expect(c.cost[k], `${m.name} spent ${k}`).toBe(0);
      }
    }
  });

  it('stops at the hall\'s ceiling rather than the module\'s', () => {
    const m = hotCandle.modules[0];
    expect(moduleCostToMax(m, 1, 12).levels).toBe(m.max[12] - 1);
    expect(m.max[12]).toBeLessThan(m.max[MAX_TH]);
  });
});

describe('sparky stones', () => {
  it('pays 8 per module level and 10 per charge level', () => {
    expect(PER_MODULE_LEVEL).toBe(8);
    expect(PER_CHARGE_LEVEL).toBe(10);
    expect(SPARKY_CAP).toBe(5000);
  });

  it('counts a supercharge per copy of the structure, not per structure', () => {
    // A charge is bought for each Cannon, so seven Cannons are seven payouts.
    const expected = Object.entries(SUPERCHARGES)
      .reduce((a, [id, c]) => a + c.length * (BUILDINGS_BY_ID[id]?.count[MAX_TH] ?? 0), 0);
    expect(sparkyFromSupercharges(MAX_TH)).toBe(expected * PER_CHARGE_LEVEL);
    expect(sparkyFromSupercharges(MAX_TH)).toBeGreaterThan(0);
  });

  it('pays nothing for supercharges below the hall that has them', () => {
    // Supercharges are a Town Hall 18 mechanic; no earlier hall has a charge to
    // buy, so no earlier hall earns a stone this way.
    expect(sparkyFromSupercharges(MAX_TH - 1)).toBe(0);
  });

  it('keeps the two sources apart, because they expire differently', () => {
    const y = sparkyAtTH(MAX_TH);
    expect(y.crafted).toBe(648);
    expect(y.supercharge).toBe(sparkyFromSupercharges(MAX_TH));
    expect(y.total).toBe(y.crafted + y.supercharge);
  });

  it('earns nothing at a hall with neither crafted defenses nor charges', () => {
    const y = sparkyAtTH(CRAFTED_DEFENSES[0].unlockTH - 1);
    expect(y.total).toBe(0);
  });
});
