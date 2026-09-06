import { describe, expect, it } from 'vitest';
import { spriteFile, spriteUrl } from '../sprites';
import { paletteFor, TOWN_HALL_ID } from '../layout';
import { MAX_TH } from '@/lib/game/town-halls';
import index from '../sprite-index.json';

const INDEX = index as Record<string, Record<string, string>>;

describe('sprite index', () => {
  it('has art for every structure the palette can place, at every Town Hall', () => {
    // The board falls back to a vector icon, so a gap here is not fatal — but
    // it is always a mistake, and silently shipping one is how the board ends
    // up half official art and half not.
    const gaps: string[] = [];
    for (let th = 1; th <= MAX_TH; th++) {
      for (const e of paletteFor(th)) {
        if (!spriteFile(e.id, e.level)) gaps.push(`TH${th} ${e.id}@${e.level}`);
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
      expect(spriteFile(id, low + 1)).toBe(byLevel[String(low)]);
      break;
    }
  });

  it('never resolves below the lowest entry to nothing', () => {
    for (const [id, byLevel] of Object.entries(INDEX)) {
      const lowest = Math.min(...Object.keys(byLevel).map(Number));
      expect(spriteFile(id, lowest - 5)).toBeTruthy();
    }
  });

  it('gives the Town Hall its own art per level', () => {
    // The clearest case of "different at each Town Hall": TH bears its level.
    const seen = new Set<string>();
    for (let th = 1; th <= MAX_TH; th++) seen.add(spriteFile(TOWN_HALL_ID, th) ?? '');
    expect(seen.size).toBeGreaterThan(MAX_TH - 3);
    expect(seen.has('')).toBe(false);
  });

  it('changes a cannon between a low and a high Town Hall', () => {
    const low = paletteFor(3).find((e) => e.id === 'cannon')!;
    const high = paletteFor(15).find((e) => e.id === 'cannon')!;
    expect(low.level).toBeLessThan(high.level);
    expect(spriteFile('cannon', low.level)).not.toBe(spriteFile('cannon', high.level));
  });

  it('builds urls under /sprites and null for an unknown structure', () => {
    expect(spriteUrl('cannon', 5)).toMatch(/^\/sprites\/[0-9a-f]+\.webp$/);
    expect(spriteUrl('not_a_building', 1)).toBeNull();
  });
});
