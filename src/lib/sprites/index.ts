/**
 * Official Clash of Clans art: structures per level, units as portraits, and
 * the three resource badges.
 *
 * Sprites come from the Clash of Clans community wiki and are used under
 * Supercell's Fan Content Policy — see README. A structure's appearance changes
 * as it upgrades, and how far it can upgrade is set by the Town Hall, so the
 * board asks for art by level: a TH4 cannon is the stubby one, a TH15 cannon
 * is not.
 *
 * Files are named by content hash and shared between levels whose art is
 * identical, which is most of them — an X-Bow looks the same across nine
 * levels. `sprite-index.json` maps structure and level onto a file.
 *
 * Resources are the simple case — one badge each, no levels — but they carry a
 * rule of their own: the badge means a *cost*, and an amount you already hold is
 * marked with the storage that banks it instead. See `STORAGE_ID`.
 *
 * Loading is lazy and cached: a village at TH3 has no reason to fetch Eagle
 * Artillery art. `onReady` fires once per image so the board can repaint as
 * art arrives, rather than blocking the first frame on hundreds of requests.
 */

import type { Resource } from '@/lib/game/types';
import buildings from './buildings.json';
import resources from './resources.json';
import units from './units.json';

type SpriteIndex = Record<string, Record<string, string>>;
const BUILDINGS: SpriteIndex = buildings as SpriteIndex;
const UNITS: Record<string, string> = units as Record<string, string>;
const RESOURCES: Record<string, string> = resources as Record<string, string>;

/**
 * The file for a structure at a level, or null if it has no art at all.
 *
 * Levels with no entry of their own fall back to the highest level below them:
 * the index only stores a level where the art actually changed, so a level 12
 * cannon legitimately resolves to the level 11 file.
 */
export function buildingSpriteFile(id: string, level: number): string | null {
  const byLevel = BUILDINGS[id];
  if (!byLevel) return null;

  const exact = byLevel[String(level)];
  if (exact) return exact;

  const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);
  if (!levels.length) return null;
  let best = levels[0];
  for (const l of levels) if (l <= level) best = l;
  return byLevel[String(best)] ?? null;
}

export function buildingSpriteUrl(id: string, level: number): string | null {
  const file = buildingSpriteFile(id, level);
  return file ? `/sprites/${file}` : null;
}

type Entry =
  | { state: 'loading' }
  | { state: 'ready'; img: HTMLImageElement }
  | { state: 'failed' };

// Keyed by file, not by structure: levels that share art share one download.
const cache = new Map<string, Entry>();

/**
 * The sprite for a structure at a level, or null while it loads or if it never
 * arrives. Callers fall back to the vector icon, so missing art degrades the
 * board rather than leaving a hole in it.
 */
export function buildingSprite(id: string, level: number, onReady: () => void): HTMLImageElement | null {
  const file = buildingSpriteFile(id, level);
  if (!file) return null;

  const hit = cache.get(file);
  if (hit) return hit.state === 'ready' ? hit.img : null;

  cache.set(file, { state: 'loading' });
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => { cache.set(file, { state: 'ready', img }); onReady(); };
  img.onerror = () => { cache.set(file, { state: 'failed' }); };
  img.src = `/sprites/${file}`;
  return null;
}

/* ------------------------------------------------------------------ units */

/**
 * Which village a unit belongs to. The two share ids — a Baby Dragon exists in
 * both — but they are different creatures, so the village is part of the key.
 */
export type Village = 'home' | 'builder';

/**
 * A unit's portrait.
 *
 * Units get one image each, not one per level, because that is what the game
 * itself shows: the Laboratory and Army screens use a fixed portrait no matter
 * what level the troop is. Structures are the opposite — the village shows
 * them at their current level — which is why buildings are indexed by level
 * and units are not.
 */
export function unitSpriteUrl(id: string, village: Village = 'home'): string | null {
  const file = UNITS[`${village}:${id}`];
  return file ? `/sprites/units/${file}` : null;
}

/* -------------------------------------------------------------- resources */

/**
 * The currency badge for a resource: the coin, the elixir drop, the dark drop.
 *
 * These are the game's own icons for the resources themselves, and unlike
 * structures they have no level and no variants — one file each, forever. They
 * mark a *cost*. What you have banked is marked by the storage that holds it,
 * which is a structure and so goes through `buildingSpriteUrl`.
 */
export function resourceSpriteUrl(kind: Resource): string | null {
  const file = RESOURCES[kind];
  return file ? `/sprites/resources/${file}` : null;
}

/** The structure that banks a resource — the icon for an amount on hand. */
export const STORAGE_ID: Record<Resource, string> = {
  gold: 'gold_storage',
  elixir: 'elixir_storage',
  dark: 'dark_storage',
};
