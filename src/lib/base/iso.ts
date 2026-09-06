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

/* ------------------------------------------------------------------ camera */

/**
 * Zoom and pan.
 *
 * The board is drawn once at full resolution into cached layers; the camera
 * only decides which rectangle of those layers gets blitted to the visible
 * canvas. Zooming is therefore a crop, not a redraw — the expensive terrain
 * and sprite work happens once regardless of zoom level.
 *
 * `cx`/`cy` are the centre of the view in layer pixels, `scale` how many
 * screen pixels one layer pixel is worth.
 */
export interface Camera { scale: number; cx: number; cy: number }

export const MIN_SCALE = 1;
export const MAX_SCALE = 5;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const initialCamera = (width: number, height: number): Camera => ({
  scale: 1, cx: width / 2, cy: height / 2,
});

/**
 * The source rectangle to blit. Clamped so the view can never show past the
 * edge of the board — panning stops at the scenery rather than at grey.
 */
export function viewport(cam: Camera, width: number, height: number) {
  const scale = clamp(cam.scale, MIN_SCALE, MAX_SCALE);
  const sw = width / scale;
  const sh = height / scale;
  return {
    sx: clamp(cam.cx - sw / 2, 0, Math.max(0, width - sw)),
    sy: clamp(cam.cy - sh / 2, 0, Math.max(0, height - sh)),
    sw,
    sh,
  };
}

/** A point on the visible canvas to the layer pixel it is showing. */
export function toLayer(
  cam: Camera, width: number, height: number, px: number, py: number,
): Point {
  const v = viewport(cam, width, height);
  return { x: v.sx + (px / width) * v.sw, y: v.sy + (py / height) * v.sh };
}

/**
 * Zoom by `factor` about a point, keeping whatever is under that point exactly
 * where it is. Zooming to the centre instead makes the thing you are aiming at
 * slide away as you scroll, which is the difference between a map and a toy.
 */
export function zoomAt(
  cam: Camera, width: number, height: number, px: number, py: number, factor: number,
): Camera {
  const anchor = toLayer(cam, width, height, px, py);
  const scale = clamp(cam.scale * factor, MIN_SCALE, MAX_SCALE);
  // Offset of the anchor from the view centre, in layer pixels, is preserved
  // in *screen* terms — so it shrinks as we zoom in.
  const sw = width / scale;
  const sh = height / scale;
  const cx = anchor.x - (px / width - 0.5) * sw;
  const cy = anchor.y - (py / height - 0.5) * sh;
  return clampCamera({ scale, cx, cy }, width, height);
}

/** Keep the centre such that the viewport stays on the board. */
export function clampCamera(cam: Camera, width: number, height: number): Camera {
  const scale = clamp(cam.scale, MIN_SCALE, MAX_SCALE);
  const sw = width / scale;
  const sh = height / scale;
  return {
    scale,
    cx: clamp(cam.cx, sw / 2, width - sw / 2),
    cy: clamp(cam.cy, sh / 2, height - sh / 2),
  };
}

/** Pan by a drag measured in visible-canvas pixels. */
export function panBy(
  cam: Camera, width: number, height: number, dxScreen: number, dyScreen: number,
): Camera {
  return clampCamera(
    { scale: cam.scale, cx: cam.cx - dxScreen / cam.scale, cy: cam.cy - dyScreen / cam.scale },
    width, height,
  );
}
