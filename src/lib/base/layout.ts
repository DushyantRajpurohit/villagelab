import { buildingsAtTH } from '../game/buildings';
import { builderBuildingsAtBH } from '../game/builder-base';
import { GRID } from '../game/town-halls';
import type { BuildingCategory, VillageId } from '../game/types';

/**
 * Base layout rules — pure, so the placement invariants can be tested without a
 * canvas. A layout is a flat list of `{ id, x, y }`, where x,y is the top-left
 * tile of a structure; its footprint comes from the palette.
 *
 * Every mutation goes through here, which is what guarantees the one property
 * that matters: a saved layout is always buildable at its Town Hall — nothing
 * overlaps, nothing hangs off the grid, nothing exceeds its per-TH count.
 */

/**
 * Both villages are laid out on the same grid.
 *
 * The Home Village's 44×44 is well established. The Builder Base's buildable
 * area is not published anywhere I could verify, so it borrows that figure
 * rather than inventing a different one: a wrong-but-generous board lets you
 * draw a layout that is slightly more spread out than the game allows, while a
 * wrong-but-tight one would refuse placements that are legal. Every count and
 * footprint limit is real either way, which is what makes a layout buildable.
 */
export { GRID };

/** The hall is not in either building table, so each gets a reserved id. */
export const TOWN_HALL_ID = '__townhall';
export const BUILDER_HALL_ID = '__builderhall';

/** The structure every layout is built around, per village. */
export const HALL_ID: Record<VillageId, string> = {
  home: TOWN_HALL_ID,
  builder: BUILDER_HALL_ID,
};

export type PaletteCategory = BuildingCategory | 'townhall';

export interface PaletteEntry {
  id: string;
  name: string;
  category: PaletteCategory;
  size: readonly [number, number];
  limit: number;
  /**
   * The level this structure sits at for the Town Hall in question — its
   * ceiling there, which is what a maxed village looks like. The board draws
   * the art for this level, so a TH5 cannon is the stubby one and a TH15
   * cannon is not.
   */
  level: number;
}

export interface Tile {
  id: string;
  x: number;
  y: number;
}

export interface BaseLayout {
  id: string;
  name: string;
  /** Town Hall or Builder Hall level, depending on the village. */
  hall: number;
  /**
   * Which village it belongs to. Layouts are stored per village anyway, so this
   * is belt and braces — but a layout is a file people copy between browsers,
   * and one that does not say which village it is for is one that can be opened
   * against the wrong palette.
   */
  village: VillageId;
  tiles: Tile[];
  updated: string;
}

export type Palette = Map<string, PaletteEntry>;

/**
 * What a hall can place, for either village.
 *
 * The two villages have different structures, different counts and different
 * ceilings, but the same rules — so they differ by the table this reads, not by
 * the code that reads it. The Builder Base's own dataset supplies its half.
 */
export function paletteFor(hall: number, village: VillageId = 'home'): PaletteEntry[] {
  if (village === 'builder') {
    return [
      { id: BUILDER_HALL_ID, name: `Builder Hall ${hall}`, category: 'townhall',
        size: [4, 4] as const, limit: 1, level: hall },
      ...builderBuildingsAtBH(hall)
        // The hall is drawn from the entry above; the dataset carries it too.
        .filter((b) => b.id !== 'builder_hall')
        .map((b) => ({
          id: b.id, name: b.name, category: b.category as PaletteCategory,
          size: b.size, limit: b.countHere, level: Math.max(1, b.maxHere),
        })),
    ];
  }
  return [
    { id: TOWN_HALL_ID, name: `Town Hall ${hall}`, category: 'townhall', size: [4, 4] as const, limit: 1, level: hall },
    ...buildingsAtTH(hall).map((b) => ({
      id: b.id, name: b.name, category: b.category as PaletteCategory,
      size: b.size, limit: b.countHere, level: b.maxHere,
    })),
  ];
}

export const paletteIndex = (entries: PaletteEntry[]): Palette =>
  new Map(entries.map((e) => [e.id, e]));

interface Box { x: number; y: number; w: number; h: number }

const boxOf = (palette: Palette, t: Tile): Box | null => {
  const p = palette.get(t.id);
  return p ? { x: t.x, y: t.y, w: p.size[0], h: p.size[1] } : null;
};

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const countOf = (tiles: Tile[], id: string): number =>
  tiles.reduce((n, t) => n + (t.id === id ? 1 : 0), 0);

/**
 * Centre a multi-tile structure under the cursor and clamp it inside the grid,
 * so dropping a 4x4 near an edge nudges it in rather than silently refusing.
 */
export function snapOrigin(size: readonly [number, number], x: number, y: number): { x: number; y: number } {
  const ox = size[0] > 1 ? x - Math.floor(size[0] / 2) : x;
  const oy = size[1] > 1 ? y - Math.floor(size[1] / 2) : y;
  return {
    x: Math.max(0, Math.min(GRID - size[0], ox)),
    y: Math.max(0, Math.min(GRID - size[1], oy)),
  };
}

export function canPlace(palette: Palette, tiles: Tile[], id: string, x: number, y: number): boolean {
  const p = palette.get(id);
  if (!p) return false;
  const [w, h] = p.size;
  if (x < 0 || y < 0 || x + w > GRID || y + h > GRID) return false;
  if (countOf(tiles, id) >= p.limit) return false;
  const box = { x, y, w, h };
  return !tiles.some((t) => {
    const o = boxOf(palette, t);
    return o !== null && overlaps(box, o);
  });
}

/** Returns a new tile list, or null when the placement is not legal. */
export function place(palette: Palette, tiles: Tile[], id: string, x: number, y: number): Tile[] | null {
  const p = palette.get(id);
  if (!p) return null;
  const at = snapOrigin(p.size, x, y);
  if (!canPlace(palette, tiles, id, at.x, at.y)) return null;
  return [...tiles, { id, x: at.x, y: at.y }];
}

/** Removes the topmost structure covering a tile. Unchanged if none does. */
export function eraseAt(palette: Palette, tiles: Tile[], x: number, y: number): Tile[] {
  for (let i = tiles.length - 1; i >= 0; i--) {
    const o = boxOf(palette, tiles[i]);
    if (o && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) {
      return [...tiles.slice(0, i), ...tiles.slice(i + 1)];
    }
  }
  return tiles;
}

export interface LayoutStats {
  placed: number;
  available: number;
  tilesUsed: number;
  coverage: number;
  /** Whether this village's hall is on the board. */
  hasHall: boolean;
}

export function statsFor(palette: Palette, entries: PaletteEntry[], tiles: Tile[]): LayoutStats {
  const tilesUsed = tiles.reduce((a, t) => {
    const p = palette.get(t.id);
    return a + (p ? p.size[0] * p.size[1] : 0);
  }, 0);

  return {
    placed: tiles.length,
    available: entries.reduce((a, e) => a + e.limit, 0),
    tilesUsed,
    coverage: (tilesUsed / (GRID * GRID)) * 100,
    hasHall: tiles.some((t) => t.id === TOWN_HALL_ID || t.id === BUILDER_HALL_ID),
  };
}

/**
 * Initials only. Digits would turn "Town Hall 14" into "TH1", which reads as a
 * Town Hall level rather than an abbreviation — a real bug from the prototype.
 */
export const abbrev = (name: string): string =>
  name.split(/[\s.-]+/)
    .map((w) => w[0])
    .filter((c) => c && /[a-z]/i.test(c))
    .join('')
    .slice(0, 3)
    .toUpperCase();

/**
 * Drop anything a layout cannot legally contain.
 *
 * Layouts live in localStorage and can be pasted in by hand, so they are
 * untrusted input by the time they get here: a layout built for TH15 opened at
 * TH9 must not silently keep structures that TH9 cannot build.
 */
export function sanitise(palette: Palette, tiles: Tile[]): Tile[] {
  const kept: Tile[] = [];
  for (const t of tiles) {
    if (!Number.isInteger(t.x) || !Number.isInteger(t.y)) continue;
    if (canPlace(palette, kept, t.id, t.x, t.y)) kept.push({ id: t.id, x: t.x, y: t.y });
  }
  return kept;
}

/**
 * Every tile on the straight line between two tiles, inclusive.
 *
 * Pointer events are sampled, not continuous: drag quickly and the browser
 * reports tiles several apart. Without this a dragged wall comes out as a
 * dotted trail, which is the difference between the tool feeling broken and
 * feeling like a paint brush.
 */
export function lineTiles(from: { x: number; y: number }, to: { x: number; y: number }): Array<{ x: number; y: number }> {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let err = dx - dy;
  let { x, y } = from;
  const out: Array<{ x: number; y: number }> = [];

  // Bresenham, with a hard cap so a bad input can never spin here.
  for (let guard = 0; guard <= GRID * 2; guard++) {
    out.push({ x, y });
    if (x === to.x && y === to.y) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return out;
}
