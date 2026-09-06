/**
 * Isometric projection for the village board.
 *
 * The grid is stored as plain (x, y) tiles; only the view is isometric. Every
 * conversion between the two lives here, pure and tested, because an off-by-one
 * in the inverse silently places structures a tile away from the cursor — the
 * kind of bug that is obvious to a user and invisible in a diff.
 *
 * The projection is the standard 2:1 diamond: one tile is TILE_W across and
 * TILE_W / 2 tall, so moving +1 in x goes right-and-down, +1 in y goes
 * left-and-down.
 */

/** Tile width in canvas pixels. Height is half of it, by definition of 2:1. */
export const TILE_W = 36;
export const TILE_H = TILE_W / 2;

/** Blank tiles of scenery around the diamond. */
export const PAD_TILES = 2;

/**
 * Headroom above the diamond's top corner. Sprites are anchored at the bottom
 * of their footprint and stand up from there, so the tallest one at the far
 * corner would otherwise be cut off by the top edge.
 */
export const HEAD_ROOM = 210;

export interface Point { x: number; y: number }
export interface Tilexy { x: number; y: number }

/** Canvas size and the origin the diamond hangs from, for a given grid. */
export function isoCanvas(grid: number) {
  const width = (grid + PAD_TILES * 2) * TILE_W;
  const height = (grid + PAD_TILES * 2) * TILE_H + HEAD_ROOM;
  return {
    width,
    height,
    // The diamond's top corner: horizontally centred, pushed down by headroom.
    originX: width / 2,
    originY: HEAD_ROOM + PAD_TILES * TILE_H,
  };
}

export interface Iso { originX: number; originY: number }

/** Tile corner (grid space, may be fractional) to canvas pixels. */
export function toScreen(iso: Iso, tx: number, ty: number): Point {
  return {
    x: iso.originX + (tx - ty) * (TILE_W / 2),
    y: iso.originY + (tx + ty) * (TILE_H / 2),
  };
}

/**
 * Canvas pixels back to the tile under them, or null outside the field.
 * Exact inverse of `toScreen`, then floored to a tile.
 */
export function toTile(iso: Iso, px: number, py: number, grid: number): Tilexy | null {
  const dx = (px - iso.originX) / (TILE_W / 2);
  const dy = (py - iso.originY) / (TILE_H / 2);
  const x = Math.floor((dx + dy) / 2);
  const y = Math.floor((dy - dx) / 2);
  return x >= 0 && x < grid && y >= 0 && y < grid ? { x, y } : null;
}

/**
 * The diamond a footprint covers: centre, the half-extents of its bounding
 * box, and the bottom corner that a sprite stands on.
 */
export function footprint(iso: Iso, tx: number, ty: number, w: number, h: number) {
  const centre = toScreen(iso, tx + w / 2, ty + h / 2);
  const halfW = ((w + h) * TILE_W) / 4;
  const halfH = ((w + h) * TILE_H) / 4;
  return {
    cx: centre.x,
    cy: centre.y,
    halfW,
    halfH,
    /** Where the ground is: the near corner of the footprint diamond. */
    baseY: centre.y + halfH,
    /** Corner points, clockwise from the top. */
    points: [
      [centre.x, centre.y - halfH],
      [centre.x + halfW, centre.y],
      [centre.x, centre.y + halfH],
      [centre.x - halfW, centre.y],
    ] as const,
  };
}

/**
 * Painter's-algorithm depth. Larger draws later, i.e. in front.
 *
 * The key is the footprint's near corner, not its origin: a 4x4 whose origin is
 * behind a 1x1 can still stand in front of it, and sorting by origin makes the
 * wall in front vanish behind the Town Hall.
 */
export const depth = (tx: number, ty: number, w: number, h: number): number =>
  tx + w + ty + h;

export const trace = (g: CanvasRenderingContext2D, pts: readonly (readonly [number, number] | number[])[]) => {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
};

/** One tile's diamond, as a path on the context. */
export function tileDiamond(g: CanvasRenderingContext2D, iso: Iso, tx: number, ty: number) {
  const top = toScreen(iso, tx, ty);
  trace(g, [
    [top.x, top.y],
    [top.x + TILE_W / 2, top.y + TILE_H / 2],
    [top.x, top.y + TILE_H],
    [top.x - TILE_W / 2, top.y + TILE_H / 2],
  ]);
}
