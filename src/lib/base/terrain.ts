/**
 * The village ground the grid sits on.
 *
 * Terrain is expensive relative to the rest of the frame — a few thousand
 * tufts and pebbles — and it never changes while you build, so it is painted
 * once onto an offscreen canvas and blitted. Repainting happens only when the
 * theme or the canvas size changes.
 *
 * Everything scattered here comes from a seeded PRNG rather than Math.random,
 * so the same village draws identically on every repaint. With Math.random the
 * grass reshuffles on each hover and the whole board shimmers.
 */

/** Tiles of scenery drawn outside the buildable grid, per side. */
export const PAD_TILES = 2;

export interface TerrainTheme {
  grass: string;
  grassAlt: string;
  /** Scenery ring outside the playable area. */
  rough: string;
  roughAlt: string;
  detail: string;
  rock: string;
  tree: string;
  treeShade: string;
  /** Grid rules over the buildable area. */
  grid: string;
  gridMajor: string;
  edge: string;
}

export const TERRAIN: Record<'light' | 'dark', TerrainTheme> = {
  light: {
    grass: '#7ba85c',
    grassAlt: '#74a156',
    rough: '#5e8a49',
    roughAlt: '#578143',
    detail: 'rgba(255,255,255,.16)',
    rock: '#9aa08c',
    tree: '#3f7038',
    treeShade: '#2f5a2b',
    grid: 'rgba(20,40,15,.10)',
    gridMajor: 'rgba(20,40,15,.20)',
    edge: 'rgba(30,50,20,.45)',
  },
  dark: {
    grass: '#3a5834',
    grassAlt: '#35512f',
    rough: '#2a4126',
    roughAlt: '#263c22',
    detail: 'rgba(255,255,255,.09)',
    rock: '#5c6357',
    tree: '#2c4f2a',
    treeShade: '#1f3b1f',
    grid: 'rgba(255,255,255,.07)',
    gridMajor: 'rgba(255,255,255,.14)',
    edge: 'rgba(0,0,0,.5)',
  },
};

/** mulberry32 — small, fast, and good enough for scattering grass. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TerrainOpts {
  /** Full canvas edge length in device pixels. */
  size: number;
  /** Buildable tiles per side. */
  grid: number;
  theme: TerrainTheme;
}

/** Pixel geometry shared by the terrain and everything drawn on top of it. */
export function geometry(size: number, grid: number) {
  const cell = size / (grid + PAD_TILES * 2);
  return { cell, origin: PAD_TILES * cell, span: grid * cell };
}

/**
 * Inverse of `geometry`: the tile a canvas point falls on, or null when it
 * lands in the scenery border. Kept pure and beside the geometry it inverts —
 * an off-by-one here silently places structures one tile from the cursor,
 * which is the kind of bug that is obvious in use and invisible in review.
 */
export function tileFromPoint(
  px: number, py: number, size: number, grid: number,
): { x: number; y: number } | null {
  const units = grid + PAD_TILES * 2;
  const x = Math.floor((px / size) * units) - PAD_TILES;
  const y = Math.floor((py / size) * units) - PAD_TILES;
  return x >= 0 && x < grid && y >= 0 && y < grid ? { x, y } : null;
}

export function paintTerrain(g: CanvasRenderingContext2D, { size, grid, theme }: TerrainOpts) {
  const { cell, origin, span } = geometry(size, grid);
  const rand = rng(0x5eed);

  // Scenery ring first, then the buildable field is laid over it.
  g.fillStyle = theme.rough;
  g.fillRect(0, 0, size, size);

  for (let i = 0; i < 900; i++) {
    const x = rand() * size;
    const y = rand() * size;
    if (x > origin - cell && x < origin + span + cell && y > origin - cell && y < origin + span + cell) continue;
    g.fillStyle = rand() > 0.5 ? theme.roughAlt : theme.detail;
    g.fillRect(x, y, cell * (0.2 + rand() * 0.5), cell * (0.14 + rand() * 0.3));
  }

  // Trees and rocks, kept clear of the field so nothing overlaps a structure.
  for (let i = 0; i < 46; i++) {
    const edge = Math.floor(rand() * 4);
    const along = rand() * size;
    const depth = (0.25 + rand() * 1.35) * cell;
    const x = edge === 0 ? along : edge === 1 ? along : edge === 2 ? depth : size - depth;
    const y = edge === 0 ? depth : edge === 1 ? size - depth : along;
    if (rand() > 0.34) {
      const r = cell * (0.4 + rand() * 0.28);
      g.fillStyle = theme.treeShade;
      g.beginPath(); g.arc(x, y + r * 0.28, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = theme.tree;
      g.beginPath(); g.arc(x, y, r * 0.9, 0, Math.PI * 2); g.fill();
    } else {
      const r = cell * (0.22 + rand() * 0.2);
      g.fillStyle = theme.rock;
      g.beginPath();
      g.ellipse(x, y, r * 1.3, r, rand() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  }

  // The buildable field: a one-tile checker, the way the game reads its grid.
  for (let ty = 0; ty < grid; ty++) {
    for (let tx = 0; tx < grid; tx++) {
      g.fillStyle = (tx + ty) % 2 === 0 ? theme.grass : theme.grassAlt;
      g.fillRect(
        Math.round(origin + tx * cell), Math.round(origin + ty * cell),
        Math.ceil(cell), Math.ceil(cell),
      );
    }
  }

  // Tufts, so the field is not a flat colour under sparse layouts.
  for (let i = 0; i < 1400; i++) {
    const x = origin + rand() * span;
    const y = origin + rand() * span;
    g.fillStyle = theme.detail;
    g.fillRect(x, y, cell * (0.1 + rand() * 0.22), cell * 0.09);
  }

  g.lineWidth = 1;
  for (const [step, stroke] of [[1, theme.grid], [4, theme.gridMajor]] as const) {
    g.strokeStyle = stroke;
    for (let i = 0; i <= grid; i += step) {
      const p = Math.round(origin + i * cell) + 0.5;
      g.beginPath(); g.moveTo(p, origin); g.lineTo(p, origin + span); g.stroke();
      g.beginPath(); g.moveTo(origin, p); g.lineTo(origin + span, p); g.stroke();
    }
  }

  g.strokeStyle = theme.edge;
  g.lineWidth = Math.max(2, cell * 0.16);
  g.strokeRect(origin - g.lineWidth / 2, origin - g.lineWidth / 2, span + g.lineWidth, span + g.lineWidth);
}
