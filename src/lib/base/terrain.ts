/**
 * The village ground the isometric grid sits on.
 *
 * Terrain is expensive relative to the rest of the frame — ~2000 diamonds plus
 * scattered scenery — and it never changes while you build, so it is painted
 * once onto an offscreen canvas and blitted. Repainting happens only when the
 * theme changes.
 *
 * Everything scattered here comes from a seeded PRNG rather than Math.random,
 * so the same village draws identically on every repaint. With Math.random the
 * grass reshuffles on each hover and the whole board shimmers.
 */

import { PAD_TILES, TILE_H, TILE_W, toScreen, tileDiamond, trace, type Iso } from './iso';

export interface TerrainTheme {
  grass: string;
  grassAlt: string;
  /** Ground outside the playable diamond. */
  rough: string;
  detail: string;
  rock: string;
  tree: string;
  treeShade: string;
  grid: string;
  edge: string;
}

export const TERRAIN: Record<'light' | 'dark', TerrainTheme> = {
  light: {
    grass: '#7cab5c',
    grassAlt: '#74a355',
    rough: '#43663a',
    detail: 'rgba(255,255,255,.14)',
    rock: '#9aa08c',
    tree: '#3f7038',
    treeShade: '#2f5a2b',
    grid: 'rgba(20,40,15,.13)',
    edge: 'rgba(28,48,20,.5)',
  },
  dark: {
    grass: '#3d5c36',
    grassAlt: '#375430',
    rough: '#1f3320',
    detail: 'rgba(255,255,255,.08)',
    rock: '#5c6357',
    tree: '#2c4f2a',
    treeShade: '#1f3b1f',
    grid: 'rgba(255,255,255,.08)',
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
  width: number;
  height: number;
  grid: number;
  iso: Iso;
  theme: TerrainTheme;
}

export function paintTerrain(
  g: CanvasRenderingContext2D,
  { width, height, grid, iso, theme }: TerrainOpts,
) {
  const rand = rng(0x5eed);

  g.fillStyle = theme.rough;
  g.fillRect(0, 0, width, height);

  // Scenery sits outside the field, on the apron the diamond leaves bare.
  // Placement is rejected rather than clamped: a tree half-over the board edge
  // reads as a bug, and the corners have room to spare.
  const outside = (px: number, py: number) => {
    const dx = (px - iso.originX) / (TILE_W / 2);
    const dy = (py - iso.originY) / (TILE_H / 2);
    const tx = (dx + dy) / 2;
    const ty = (dy - dx) / 2;
    return tx < -0.6 || ty < -0.6 || tx > grid + 0.6 || ty > grid + 0.6;
  };

  for (let i = 0; i < 1100; i++) {
    const x = rand() * width;
    const y = rand() * height;
    if (!outside(x, y)) continue;
    g.fillStyle = theme.detail;
    g.fillRect(x, y, TILE_W * (0.1 + rand() * 0.3), TILE_H * (0.14 + rand() * 0.3));
  }

  for (let i = 0; i < 150; i++) {
    const x = rand() * width;
    const y = rand() * height;
    if (!outside(x, y)) continue;
    if (rand() > 0.35) {
      const r = TILE_W * (0.22 + rand() * 0.16);
      g.fillStyle = theme.treeShade;
      g.beginPath(); g.ellipse(x, y + r * 0.5, r * 1.05, r * 0.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = theme.tree;
      g.beginPath(); g.arc(x, y, r * 0.85, 0, Math.PI * 2); g.fill();
    } else {
      const r = TILE_W * (0.1 + rand() * 0.1);
      g.fillStyle = theme.rock;
      g.beginPath(); g.ellipse(x, y, r * 1.4, r, rand() * Math.PI, 0, Math.PI * 2); g.fill();
    }
  }

  // The field: one diamond per tile, in a two-tone checker like the game's.
  for (let ty = 0; ty < grid; ty++) {
    for (let tx = 0; tx < grid; tx++) {
      tileDiamond(g, iso, tx, ty);
      g.fillStyle = (tx + ty) % 2 === 0 ? theme.grass : theme.grassAlt;
      g.fill();
    }
  }

  // Tufts, so the field is not flat colour under a sparse layout.
  for (let i = 0; i < 1600; i++) {
    const tx = rand() * grid;
    const ty = rand() * grid;
    const p = toScreen(iso, tx, ty);
    g.fillStyle = theme.detail;
    g.fillRect(p.x, p.y, TILE_W * (0.08 + rand() * 0.16), TILE_H * 0.16);
  }

  g.strokeStyle = theme.grid;
  g.lineWidth = 1;
  for (let i = 0; i <= grid; i++) {
    for (const [a, b] of [
      [toScreen(iso, i, 0), toScreen(iso, i, grid)],
      [toScreen(iso, 0, i), toScreen(iso, grid, i)],
    ]) {
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }
  }

  const c = [toScreen(iso, 0, 0), toScreen(iso, grid, 0), toScreen(iso, grid, grid), toScreen(iso, 0, grid)];
  trace(g, c.map((p) => [p.x, p.y]));
  g.strokeStyle = theme.edge;
  g.lineWidth = Math.max(2, TILE_H * 0.3);
  g.stroke();
}

export { PAD_TILES };
