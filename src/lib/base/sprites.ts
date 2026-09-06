/**
 * Official structure art, per level, loaded on demand.
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
 * Loading is lazy and cached: a village at TH3 has no reason to fetch Eagle
 * Artillery art. `onReady` fires once per image so the board can repaint as
 * art arrives, rather than blocking the first frame on hundreds of requests.
 */

import index from './sprite-index.json';

type SpriteIndex = Record<string, Record<string, string>>;
const INDEX: SpriteIndex = index as SpriteIndex;

/**
 * The file for a structure at a level, or null if it has no art at all.
 *
 * Levels with no entry of their own fall back to the highest level below them:
 * the index only stores a level where the art actually changed, so a level 12
 * cannon legitimately resolves to the level 11 file.
 */
export function spriteFile(id: string, level: number): string | null {
  const byLevel = INDEX[id];
  if (!byLevel) return null;

  const exact = byLevel[String(level)];
  if (exact) return exact;

  const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);
  if (!levels.length) return null;
  let best = levels[0];
  for (const l of levels) if (l <= level) best = l;
  return byLevel[String(best)] ?? null;
}

export function spriteUrl(id: string, level: number): string | null {
  const file = spriteFile(id, level);
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
export function sprite(id: string, level: number, onReady: () => void): HTMLImageElement | null {
  const file = spriteFile(id, level);
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
