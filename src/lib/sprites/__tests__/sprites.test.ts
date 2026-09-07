import { describe, expect, it } from 'vitest';
import {
  buildingSpriteFile, buildingSpriteUrl, resourceSpriteUrl, unitSpriteUrl, STORAGE_ID,
} from '@/lib/sprites';
import { ALL_UNITS } from '@/lib/game/army';
import { buildingsAtTH } from '@/lib/game/buildings';
import type { Resource } from '@/lib/game/types';
import { BUILDER_UNITS } from '@/lib/game/builder-base';
import { paletteFor, TOWN_HALL_ID, type PaletteEntry } from '@/lib/base/layout';
import { MAX_TH } from '@/lib/game/town-halls';
import index from '@/lib/sprites/buildings.json';

const INDEX = index as Record<string, Record<string, string>>;

describe('sprite index', () => {
  it('has art for every structure the palette can place, at every Town Hall', () => {
    // The board falls back to a vector icon, so a gap here is not fatal — but
    // it is always a mistake, and silently shipping one is how the board ends
    // up half official art and half not.
    const gaps: string[] = [];
    for (let th = 1; th <= MAX_TH; th++) {
      for (const e of paletteFor(th)) {
        if (!buildingSpriteFile(e.id, e.level)) gaps.push(`TH${th} ${e.id}@${e.level}`);
      }
    }
    expect(gaps).toEqual([]);
  });

  it('resolves a level with no entry of its own to the highest one below it', () => {
    for (const [id, byLevel] of Object.entries(INDEX)) {
      const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);
      if (levels.length < 2) continue;
      const [low, high] = [levels[0], levels[1]];
      if (high - low < 2) continue;
      // A level strictly between two entries takes the lower one's art.
      expect(buildingSpriteFile(id, low + 1)).toBe(byLevel[String(low)]);
      break;
    }
  });

  it('never resolves below the lowest entry to nothing', () => {
    for (const [id, byLevel] of Object.entries(INDEX)) {
      const lowest = Math.min(...Object.keys(byLevel).map(Number));
      expect(buildingSpriteFile(id, lowest - 5)).toBeTruthy();
    }
  });

  it('gives the Town Hall its own art per level', () => {
    // The clearest case of "different at each Town Hall": TH bears its level.
    const seen = new Set<string>();
    for (let th = 1; th <= MAX_TH; th++) seen.add(buildingSpriteFile(TOWN_HALL_ID, th) ?? '');
    expect(seen.size).toBeGreaterThan(MAX_TH - 3);
    expect(seen.has('')).toBe(false);
  });

  it('changes a cannon between a low and a high Town Hall', () => {
    const low = paletteFor(3).find((e: PaletteEntry) => e.id === 'cannon')!;
    const high = paletteFor(15).find((e: PaletteEntry) => e.id === 'cannon')!;
    expect(low.level).toBeLessThan(high.level);
    expect(buildingSpriteFile('cannon', low.level)).not.toBe(buildingSpriteFile('cannon', high.level));
  });

  it('builds urls under /sprites and null for an unknown structure', () => {
    expect(buildingSpriteUrl('cannon', 5)).toMatch(/^\/sprites\/[0-9a-f]+\.webp$/);
    expect(buildingSpriteUrl('not_a_building', 1)).toBeNull();
  });
});

describe('unit portraits', () => {
  it('has a portrait for every unit in both villages', () => {
    const gaps: string[] = [];
    for (const u of ALL_UNITS) if (!unitSpriteUrl(u.id, 'home')) gaps.push(`home:${u.id}`);
    for (const u of BUILDER_UNITS) if (!unitSpriteUrl(u.id, 'builder')) gaps.push(`builder:${u.id}`);
    expect(gaps).toEqual([]);
  });

  it('keys by village, so the two Baby Dragons can differ', () => {
    // The home and Builder Base Baby Dragon share an id but are different
    // troops. They currently resolve to the same file because the wiki has no
    // separate portrait, but the key is per village so that can be corrected
    // without touching callers.
    expect(ALL_UNITS.some((u) => u.id === 'baby_dragon')).toBe(true);
    expect(BUILDER_UNITS.some((u) => u.id === 'baby_dragon')).toBe(true);
    expect(unitSpriteUrl('baby_dragon', 'home')).toBeTruthy();
    expect(unitSpriteUrl('baby_dragon', 'builder')).toBeTruthy();
  });

  it('returns null for a unit that does not exist', () => {
    expect(unitSpriteUrl('not_a_troop')).toBeNull();
    expect(unitSpriteUrl('barbarian', 'builder')).toBeNull();
  });

  it('points every portrait under /sprites/units', () => {
    for (const u of ALL_UNITS) {
      expect(unitSpriteUrl(u.id)).toMatch(/^\/sprites\/units\/[0-9a-f]+\.webp$/);
    }
  });
});

describe('resource badges', () => {
  const RESOURCES: Resource[] = ['gold', 'elixir', 'dark'];

  it('has a badge for every resource, under /sprites/resources', () => {
    for (const k of RESOURCES) {
      expect(resourceSpriteUrl(k)).toMatch(/^\/sprites\/resources\/[0-9a-f]+\.webp$/);
    }
  });

  it('gives each resource its own badge', () => {
    expect(new Set(RESOURCES.map((k) => resourceSpriteUrl(k))).size).toBe(RESOURCES.length);
  });

  it('names a real storage for each resource, with art at every Town Hall it exists at', () => {
    // An amount on hand is marked with the storage that banks it, so a gap here
    // shows up as a missing icon next to a number the user typed themselves.
    const gaps: string[] = [];
    for (let th = 1; th <= MAX_TH; th++) {
      const here = buildingsAtTH(th);
      for (const k of RESOURCES) {
        const b = here.find((x) => x.id === STORAGE_ID[k]);
        if (b && !buildingSpriteFile(b.id, b.maxHere)) gaps.push(`TH${th} ${b.id}@${b.maxHere}`);
      }
    }
    expect(gaps).toEqual([]);
  });

  it('has no Dark Elixir Storage below TH7, which is why the icon falls back', () => {
    const at = (th: number) => buildingsAtTH(th).some((b) => b.id === STORAGE_ID.dark);
    expect(at(6)).toBe(false);
    expect(at(7)).toBe(true);
  });
});
