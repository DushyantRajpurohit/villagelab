import { describe, expect, it } from 'vitest';
import {
  GRID, TOWN_HALL_ID, abbrev, canPlace, countOf, eraseAt, paletteFor,
  lineTiles, paletteIndex, place, sanitise, snapOrigin, statsFor, type Tile,
} from '../layout';
import { geometry, tileFromPoint } from '../terrain';
import { MAX_TH } from '@/lib/game/town-halls';

const entries = paletteFor(14);
const palette = paletteIndex(entries);
const size = (id: string) => palette.get(id)!.size;

describe('palette', () => {
  it('always offers a Town Hall, exactly one of it', () => {
    for (let th = 1; th <= MAX_TH; th++) {
      const p = paletteFor(th);
      expect(p[0].id, `TH${th}`).toBe(TOWN_HALL_ID);
      expect(p[0].limit, `TH${th}`).toBe(1);
      expect(p[0].name, `TH${th}`).toBe(`Town Hall ${th}`);
    }
  });

  it('only offers structures that exist at that Town Hall', () => {
    for (const e of paletteFor(9)) expect(e.limit, e.id).toBeGreaterThan(0);
  });

  it('offers more at a higher Town Hall than a lower one', () => {
    const low = paletteFor(9).reduce((a, e) => a + e.limit, 0);
    const high = paletteFor(15).reduce((a, e) => a + e.limit, 0);
    expect(high).toBeGreaterThan(low);
  });
});

describe('snapOrigin', () => {
  it('centres a multi-tile structure under the cursor', () => {
    expect(snapOrigin([4, 4], 20, 20)).toEqual({ x: 18, y: 18 });
  });

  it('leaves a single tile exactly where it was clicked', () => {
    expect(snapOrigin([1, 1], 7, 3)).toEqual({ x: 7, y: 3 });
  });

  it('nudges an edge drop back inside the grid instead of refusing it', () => {
    expect(snapOrigin([4, 4], 0, 0)).toEqual({ x: 0, y: 0 });
    expect(snapOrigin([4, 4], GRID - 1, GRID - 1)).toEqual({ x: GRID - 4, y: GRID - 4 });
  });
});

describe('canPlace', () => {
  it('rejects a structure hanging off the grid', () => {
    expect(canPlace(palette, [], TOWN_HALL_ID, GRID - 2, 0)).toBe(false);
    expect(canPlace(palette, [], TOWN_HALL_ID, GRID - 4, 0)).toBe(true);
  });

  it('rejects an overlap', () => {
    const tiles = place(palette, [], TOWN_HALL_ID, 20, 20)!;
    // The Town Hall occupies 18..21 in both axes after snapping.
    expect(canPlace(palette, tiles, 'cannon', 19, 19)).toBe(false);
    expect(canPlace(palette, tiles, 'cannon', 22, 22)).toBe(true);
  });

  it('detects an overlap from either direction', () => {
    // A 1x1 dropped inside a 4x4, and a 4x4 dropped over a 1x1.
    const withWall: Tile[] = [{ id: 'wall', x: 19, y: 19 }];
    expect(canPlace(palette, withWall, TOWN_HALL_ID, 18, 18)).toBe(false);
    const withTh: Tile[] = [{ id: TOWN_HALL_ID, x: 18, y: 18 }];
    expect(canPlace(palette, withTh, 'wall', 19, 19)).toBe(false);
  });

  it('allows structures that merely touch', () => {
    const tiles: Tile[] = [{ id: TOWN_HALL_ID, x: 10, y: 10 }];
    expect(canPlace(palette, tiles, 'wall', 14, 10)).toBe(true);
    expect(canPlace(palette, tiles, 'wall', 13, 10)).toBe(false);
  });

  it('enforces the per-Town-Hall count limit', () => {
    const [w, h] = size('cannon');
    const limit = palette.get('cannon')!.limit;
    const perRow = Math.floor(GRID / (w + 1));
    let tiles: Tile[] = [];
    for (let i = 0; i < limit; i++) {
      // Step by the footprint plus a gap; `place` centres, so aim at the middle.
      const x = (i % perRow) * (w + 1) + Math.floor(w / 2);
      const y = Math.floor(i / perRow) * (h + 1) + Math.floor(h / 2);
      const next = place(palette, tiles, 'cannon', x, y);
      expect(next, `placing cannon ${i + 1}`).not.toBeNull();
      tiles = next!;
    }
    expect(countOf(tiles, 'cannon')).toBe(limit);
    expect(place(palette, tiles, 'cannon', 40, 40)).toBeNull();
  });

  it('refuses an id that is not in the palette', () => {
    expect(canPlace(palette, [], 'not-a-building', 0, 0)).toBe(false);
    expect(place(palette, [], 'not-a-building', 0, 0)).toBeNull();
  });
});

describe('place and erase', () => {
  it('does not mutate the list it was given', () => {
    const tiles: Tile[] = [];
    const next = place(palette, tiles, TOWN_HALL_ID, 5, 5)!;
    expect(tiles).toHaveLength(0);
    expect(next).toHaveLength(1);
  });

  it('erases whichever structure covers the tile, not just its origin', () => {
    const tiles = place(palette, [], TOWN_HALL_ID, 20, 20)!;
    // 21,21 is inside the footprint but is not the top-left corner.
    expect(eraseAt(palette, tiles, 21, 21)).toHaveLength(0);
    expect(eraseAt(palette, tiles, 30, 30)).toHaveLength(1);
  });

  it('removes only the topmost structure at that tile', () => {
    const tiles: Tile[] = [{ id: 'wall', x: 1, y: 1 }, { id: 'wall', x: 2, y: 2 }];
    expect(eraseAt(palette, tiles, 2, 2)).toEqual([{ id: 'wall', x: 1, y: 1 }]);
  });
});

describe('stats', () => {
  it('measures coverage as a share of the whole grid', () => {
    const tiles = place(palette, [], TOWN_HALL_ID, 20, 20)!;
    const s = statsFor(palette, entries, tiles);
    expect(s.placed).toBe(1);
    expect(s.tilesUsed).toBe(16);
    expect(s.coverage).toBeCloseTo((16 / (GRID * GRID)) * 100);
    expect(s.hasTownHall).toBe(true);
  });

  it('is empty-safe', () => {
    const s = statsFor(palette, entries, []);
    expect(s).toMatchObject({ placed: 0, tilesUsed: 0, coverage: 0, hasTownHall: false });
    expect(s.available).toBeGreaterThan(0);
  });
});

describe('sanitise', () => {
  it('drops structures a lower Town Hall cannot build', () => {
    const th9 = paletteIndex(paletteFor(9));
    const built: Tile[] = [
      { id: TOWN_HALL_ID, x: 20, y: 20 },
      { id: 'scattershot', x: 2, y: 2 }, // TH13+
    ];
    const kept = sanitise(th9, built);
    expect(kept.map((t) => t.id)).toEqual([TOWN_HALL_ID]);
  });

  it('drops overlaps and out-of-bounds tiles from hand-edited input', () => {
    const dirty: Tile[] = [
      { id: TOWN_HALL_ID, x: 10, y: 10 },
      { id: 'wall', x: 11, y: 11 },        // inside the Town Hall
      { id: 'wall', x: GRID, y: 0 },       // off the grid
      { id: 'wall', x: 1.5, y: 3 },        // not an integer tile
      { id: 'wall', x: 30, y: 30 },        // fine
    ];
    expect(sanitise(palette, dirty)).toEqual([
      { id: TOWN_HALL_ID, x: 10, y: 10 },
      { id: 'wall', x: 30, y: 30 },
    ]);
  });

  it('leaves a legal layout untouched', () => {
    let tiles: Tile[] = [];
    for (let i = 0; i < 12; i++) tiles = place(palette, tiles, 'wall', i * 2, 0) ?? tiles;
    expect(sanitise(palette, tiles)).toEqual(tiles);
  });
});

describe('abbrev', () => {
  it('takes initials and ignores digits', () => {
    expect(abbrev('Town Hall 14')).toBe('TH');
    expect(abbrev('Archer Tower')).toBe('AT');
    expect(abbrev('X-Bow')).toBe('XB');
    expect(abbrev('Cannon')).toBe('C');
  });

  it('caps at three letters', () => {
    expect(abbrev('Air Defense Anti Something')).toHaveLength(3);
  });

  it('never returns a digit for any real building', () => {
    for (const e of paletteFor(MAX_TH)) expect(abbrev(e.name), e.name).not.toMatch(/\d/);
  });
});

describe('lineTiles', () => {
  it('returns the single tile when there is no movement', () => {
    expect(lineTiles({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual([{ x: 5, y: 5 }]);
  });

  it('fills a horizontal run with no gaps', () => {
    const line = lineTiles({ x: 2, y: 7 }, { x: 6, y: 7 });
    expect(line).toEqual([
      { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 },
    ]);
  });

  it('works backwards and vertically', () => {
    expect(lineTiles({ x: 4, y: 9 }, { x: 4, y: 6 }).map((t) => t.y)).toEqual([9, 8, 7, 6]);
    expect(lineTiles({ x: 9, y: 1 }, { x: 6, y: 1 }).map((t) => t.x)).toEqual([9, 8, 7, 6]);
  });

  it('leaves no diagonal gap — every step is adjacent to the last', () => {
    const line = lineTiles({ x: 0, y: 0 }, { x: 17, y: 9 });
    expect(line[0]).toEqual({ x: 0, y: 0 });
    expect(line[line.length - 1]).toEqual({ x: 17, y: 9 });
    for (let i = 1; i < line.length; i++) {
      expect(Math.abs(line[i].x - line[i - 1].x)).toBeLessThanOrEqual(1);
      expect(Math.abs(line[i].y - line[i - 1].y)).toBeLessThanOrEqual(1);
    }
  });

  it('is bounded even across the whole grid', () => {
    const line = lineTiles({ x: 0, y: 0 }, { x: GRID - 1, y: GRID - 1 });
    expect(line).toHaveLength(GRID);
  });
});

describe('canvas geometry', () => {
  const SIZE = 1320;

  it('maps the centre of every tile back to that tile', () => {
    const { cell, origin } = geometry(SIZE, GRID);
    for (const [tx, ty] of [[0, 0], [0, GRID - 1], [GRID - 1, 0], [GRID - 1, GRID - 1], [21, 13]]) {
      const px = origin + (tx + 0.5) * cell;
      const py = origin + (ty + 0.5) * cell;
      expect(tileFromPoint(px, py, SIZE, GRID)).toEqual({ x: tx, y: ty });
    }
  });

  it('round-trips every tile on the board', () => {
    const { cell, origin } = geometry(SIZE, GRID);
    for (let ty = 0; ty < GRID; ty++) {
      for (let tx = 0; tx < GRID; tx++) {
        const hit = tileFromPoint(origin + (tx + 0.5) * cell, origin + (ty + 0.5) * cell, SIZE, GRID);
        expect(hit).toEqual({ x: tx, y: ty });
      }
    }
  });

  it('rejects the scenery border rather than clamping into the field', () => {
    const { cell, origin, span } = geometry(SIZE, GRID);
    expect(tileFromPoint(0, 0, SIZE, GRID)).toBeNull();
    expect(tileFromPoint(SIZE - 1, SIZE - 1, SIZE, GRID)).toBeNull();
    // Just outside each edge of the field.
    expect(tileFromPoint(origin - cell * 0.5, origin + span / 2, SIZE, GRID)).toBeNull();
    expect(tileFromPoint(origin + span + cell * 0.5, origin + span / 2, SIZE, GRID)).toBeNull();
    expect(tileFromPoint(origin + span / 2, origin - cell * 0.5, SIZE, GRID)).toBeNull();
    expect(tileFromPoint(origin + span / 2, origin + span + cell * 0.5, SIZE, GRID)).toBeNull();
  });

  it('puts the field inside the canvas with room for the border', () => {
    const { origin, span } = geometry(SIZE, GRID);
    expect(origin).toBeGreaterThan(0);
    expect(origin + span).toBeLessThan(SIZE);
    expect(origin).toBeCloseTo(SIZE - (origin + span), 6);
  });
});
