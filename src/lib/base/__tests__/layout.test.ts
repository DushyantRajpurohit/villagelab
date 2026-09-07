import { describe, expect, it } from 'vitest';
import {
  GRID, TOWN_HALL_ID, abbrev, canPlace, countOf, eraseAt, paletteFor,
  lineTiles, paletteIndex, place, sanitise, snapOrigin, statsFor, type Tile,
} from '../layout';
import {
  depth, footprint, isoCanvas, toScreen, toTile, TILE_W, TILE_H,
  initialCamera, panBy, toLayer, viewport, zoomAt, MAX_SCALE, MIN_SCALE,
} from '../iso';
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
    expect(s.hasHall).toBe(true);
  });

  it('is empty-safe', () => {
    const s = statsFor(palette, entries, []);
    expect(s).toMatchObject({ placed: 0, tilesUsed: 0, coverage: 0, hasHall: false });
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

describe('isometric projection', () => {
  const VIEW = isoCanvas(GRID);

  it('round-trips the centre of every tile on the board', () => {
    for (let ty = 0; ty < GRID; ty++) {
      for (let tx = 0; tx < GRID; tx++) {
        const c = toScreen(VIEW, tx + 0.5, ty + 0.5);
        expect(toTile(VIEW, c.x, c.y, GRID)).toEqual({ x: tx, y: ty });
      }
    }
  });

  it('projects the four corners to the diamond, not a square', () => {
    const top = toScreen(VIEW, 0, 0);
    const right = toScreen(VIEW, GRID, 0);
    const bottom = toScreen(VIEW, GRID, GRID);
    const left = toScreen(VIEW, 0, GRID);
    // Top and bottom share an x; left and right share a y. That is the diamond.
    expect(right.x - top.x).toBeCloseTo(top.x - left.x, 6);
    expect(bottom.x).toBeCloseTo(top.x, 6);
    expect(left.y).toBeCloseTo(right.y, 6);
    // And it is 2:1 — twice as wide as it is tall.
    expect(right.x - left.x).toBeCloseTo((bottom.y - top.y) * 2, 6);
  });

  it('rejects points outside the field rather than clamping into it', () => {
    const top = toScreen(VIEW, 0, 0);
    expect(toTile(VIEW, top.x, top.y - TILE_H, GRID)).toBeNull();
    expect(toTile(VIEW, 0, 0, GRID)).toBeNull();
    expect(toTile(VIEW, VIEW.width, VIEW.height, GRID)).toBeNull();
    // Just off each of the four diagonal edges.
    const left = toScreen(VIEW, 0, GRID / 2);
    expect(toTile(VIEW, left.x - TILE_W, left.y, GRID)).toBeNull();
    const right = toScreen(VIEW, GRID, GRID / 2);
    expect(toTile(VIEW, right.x + TILE_W, right.y, GRID)).toBeNull();
  });

  it('keeps the whole board inside the canvas', () => {
    for (const [x, y] of [[0, 0], [GRID, 0], [GRID, GRID], [0, GRID]]) {
      const p = toScreen(VIEW, x, y);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(VIEW.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(VIEW.height);
    }
    // Headroom above the top corner, so tall sprites are not clipped.
    expect(toScreen(VIEW, 0, 0).y).toBeGreaterThan(100);
  });

  it('sizes a footprint diamond from its tile span', () => {
    const one = footprint(VIEW, 10, 10, 1, 1);
    const four = footprint(VIEW, 10, 10, 4, 4);
    expect(one.halfW * 2).toBeCloseTo(TILE_W, 6);
    expect(four.halfW).toBeCloseTo(one.halfW * 4, 6);
    // The near corner is where a sprite stands.
    expect(four.baseY).toBeCloseTo(four.cy + four.halfH, 6);
  });

  it('orders a structure in front of one behind it', () => {
    // A 1x1 nearer the viewer must paint after a 4x4 whose origin is further back.
    expect(depth(12, 12, 1, 1)).toBeGreaterThan(depth(8, 8, 4, 4) - 8);
    expect(depth(0, 0, 4, 4)).toBeLessThan(depth(20, 20, 1, 1));
    expect(depth(5, 5, 1, 1)).toBeLessThan(depth(5, 6, 1, 1));
  });
});

describe('camera', () => {
  const V = isoCanvas(GRID);
  const base = initialCamera(V.width, V.height);

  it('shows the whole board at rest', () => {
    const v = viewport(base, V.width, V.height);
    expect(v.sx).toBe(0);
    expect(v.sy).toBe(0);
    expect(v.sw).toBe(V.width);
    expect(v.sh).toBe(V.height);
  });

  it('keeps the point under the cursor fixed while zooming', () => {
    // The whole point of zoom-to-cursor: whatever is under the pointer stays
    // under the pointer, so aiming at a corner of the base actually works.
    for (const [px, py] of [[100, 80], [V.width / 2, V.height / 2], [V.width - 40, V.height - 30]]) {
      const before = toLayer(base, V.width, V.height, px, py);
      const zoomed = zoomAt(base, V.width, V.height, px, py, 2);
      const after = toLayer(zoomed, V.width, V.height, px, py);
      expect(after.x).toBeCloseTo(before.x, 4);
      expect(after.y).toBeCloseTo(before.y, 4);
    }
  });

  it('clamps zoom to its range', () => {
    let c = base;
    for (let i = 0; i < 40; i++) c = zoomAt(c, V.width, V.height, 10, 10, 2);
    expect(c.scale).toBe(MAX_SCALE);
    for (let i = 0; i < 40; i++) c = zoomAt(c, V.width, V.height, 10, 10, 0.5);
    expect(c.scale).toBe(MIN_SCALE);
  });

  it('never pans past the edge of the board', () => {
    let c = zoomAt(base, V.width, V.height, V.width / 2, V.height / 2, 3);
    for (const [dx, dy] of [[9e4, 9e4], [-9e4, -9e4], [9e4, -9e4]]) {
      c = panBy(c, V.width, V.height, dx, dy);
      const v = viewport(c, V.width, V.height);
      expect(v.sx).toBeGreaterThanOrEqual(-1e-6);
      expect(v.sy).toBeGreaterThanOrEqual(-1e-6);
      expect(v.sx + v.sw).toBeLessThanOrEqual(V.width + 1e-6);
      expect(v.sy + v.sh).toBeLessThanOrEqual(V.height + 1e-6);
    }
  });

  it('cannot pan at all when the whole board is visible', () => {
    const c = panBy(base, V.width, V.height, 500, 500);
    const v = viewport(c, V.width, V.height);
    expect(v.sx).toBe(0);
    expect(v.sy).toBe(0);
  });

  it('round-trips a tile through the camera at any zoom', () => {
    // Hit-testing goes screen -> layer -> tile; if zoom broke that, every click
    // while zoomed would land on the wrong tile.
    const c = zoomAt(base, V.width, V.height, V.width / 2, V.height / 2, 2.5);
    const v = viewport(c, V.width, V.height);
    for (const [tx, ty] of [[22, 22], [21, 23], [23, 21]]) {
      const centre = toScreen(V, tx + 0.5, ty + 0.5);
      // Where that tile centre appears on screen under this camera.
      const px = ((centre.x - v.sx) / v.sw) * V.width;
      const py = ((centre.y - v.sy) / v.sh) * V.height;
      const back = toLayer(c, V.width, V.height, px, py);
      expect(toTile(V, back.x, back.y, GRID)).toEqual({ x: tx, y: ty });
    }
  });
});

describe('sanitise as a trust boundary', () => {
  it('drops structures the Town Hall cannot build even when the layout claims that TH', () => {
    // Layouts come from localStorage, so their `th` is a claim. A layout
    // tagged TH3 can still hold TH14 structures.
    const th3 = paletteIndex(paletteFor(3));
    const smuggled: Tile[] = [
      { id: 'cannon', x: 0, y: 0 },
      { id: 'inferno_tower', x: 10, y: 10 },  // TH10+
      { id: 'eagle_artillery', x: 20, y: 20 }, // TH11+
    ];
    const kept = sanitise(th3, smuggled);
    expect(kept.map((t) => t.id)).toEqual(['cannon']);
  });

  it('enforces per-Town-Hall counts, not just which structures exist', () => {
    const th3 = paletteIndex(paletteFor(3));
    const limit = paletteFor(3).find((e) => e.id === 'cannon')!.limit;
    const many: Tile[] = Array.from({ length: limit + 4 }, (_, i) => ({
      id: 'cannon', x: (i % 8) * 4, y: Math.floor(i / 8) * 4,
    }));
    expect(sanitise(th3, many)).toHaveLength(limit);
  });
});
