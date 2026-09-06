/**
 * Official structure art, loaded on demand.
 *
 * Sprites come from the Clash of Clans community wiki and are used under
 * Supercell's Fan Content Policy — see README. One file per structure, at the
 * highest level the game data says exists, served from /public/sprites.
 *
 * Loading is lazy and cached: a village at TH3 has no reason to fetch the
 * Eagle Artillery. `onReady` fires once per image so the board can repaint as
 * art arrives, rather than blocking the first frame on 44 requests.
 */

type Entry =
  | { state: 'loading' }
  | { state: 'ready'; img: HTMLImageElement }
  | { state: 'failed' };

const cache = new Map<string, Entry>();

/**
 * The sprite for a structure, or null while it loads or if it never arrives.
 * Callers fall back to the vector icon, so a missing file degrades rather than
 * leaving a hole in the board.
 */
export function sprite(id: string, onReady: () => void): HTMLImageElement | null {
  const hit = cache.get(id);
  if (hit) return hit.state === 'ready' ? hit.img : null;

  cache.set(id, { state: 'loading' });
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => { cache.set(id, { state: 'ready', img }); onReady(); };
  img.onerror = () => { cache.set(id, { state: 'failed' }); };
  img.src = spriteUrl(id);
  return null;
}

export const spriteUrl = (id: string): string => `/sprites/${id}.webp`;
