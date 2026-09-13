import { describe, expect, it } from 'vitest';
import { BUILDINGS_BY_ID, SUPERCHARGES, superchargeBill } from '../buildings';
import { PER_CHARGE_LEVEL, sparkyFromSupercharges } from '../sparky';
import { MAX_TH } from '../town-halls';
import raw from '../home-buildings.json';

/**
 * The supercharge bill is a second total built from the same charge tables the
 * Sparky Stone yield reads, so the two are pinned against each other as well as
 * against the tables.
 */

type RawEntry = { resource: string; count: Record<string, number>; supercharge?: { cost: number; hours: number }[] };
const RAW = raw as unknown as Record<string, RawEntry>;

describe('supercharge bill', () => {
  it('is empty below the top hall', () => {
    const b = superchargeBill(MAX_TH - 1);
    expect(b).toMatchObject({ hours: 0, charges: 0, structures: 0, kinds: 0 });
    expect(b.cost).toEqual({ gold: 0, elixir: 0, dark: 0 });
  });

  it('charges all eighteen kinds the Supercharge page names', () => {
    expect(superchargeBill(MAX_TH).kinds).toBe(18);
    expect(Object.keys(SUPERCHARGES)).toHaveLength(18);
  });

  it('bills each copy, in the structure\'s own currency', () => {
    const expected = { gold: 0, elixir: 0, dark: 0 } as Record<string, number>;
    let hours = 0;
    for (const [id, entry] of Object.entries(RAW)) {
      if (!entry.supercharge) continue;
      const copies = BUILDINGS_BY_ID[id].count[MAX_TH];
      for (const c of entry.supercharge) {
        expected[entry.resource] += c.cost * copies;
        hours += c.hours * copies;
      }
    }
    const b = superchargeBill(MAX_TH);
    expect(b.cost).toEqual(expected);
    expect(b.hours).toBe(hours);
  });

  it('prices a collector\'s charges like its levels, not in gold', () => {
    // A Gold Mine is built with elixir, and so are its charges; the Monolith's
    // are dark elixir. Only those differ from gold, so they account for every
    // non-gold unit of the bill.
    const copies = (id: string) => BUILDINGS_BY_ID[id].count[MAX_TH];
    const sum = (id: string) => SUPERCHARGES[id].reduce((a, c) => a + c.cost, 0) * copies(id);
    const b = superchargeBill(MAX_TH);
    expect(b.cost.elixir).toBe(sum('gold_mine') + sum('dark_drill'));
    expect(b.cost.dark).toBe(sum('monolith') + sum('revenge_tower'));
  });

  it('matches the Mortar\'s published charges', () => {
    // 9,000,000 over 4d, then 7,000,000 over 6d.
    expect(SUPERCHARGES.mortar.map((c) => [c.cost, c.hours])).toEqual([[9_000_000, 96], [7_000_000, 144]]);
  });

  it('pays Sparky Stones on exactly the charges it bills', () => {
    const b = superchargeBill(MAX_TH);
    expect(sparkyFromSupercharges(MAX_TH)).toBe(b.charges * PER_CHARGE_LEVEL);
    expect(sparkyFromSupercharges(MAX_TH)).toBe(1350);
  });
});
