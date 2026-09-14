import type { RawPlayer } from './client';

/**
 * The `players.units` column: every level list the API sends, as one JSON blob.
 *
 * Writing and reading it live side by side here because they used to live in
 * two files, and hero equipment was added to the reader's type and the page
 * but never to the writer — so every ingested player came back owning no
 * equipment at all, and only mock mode, which skips the column, looked right.
 */

export type StoredUnits = Pick<RawPlayer, 'troops' | 'spells' | 'heroes' | 'heroEquipment'>;

export const packUnits = (p: StoredUnits): string =>
  JSON.stringify({
    troops: p.troops ?? [],
    spells: p.spells ?? [],
    heroes: p.heroes ?? [],
    heroEquipment: p.heroEquipment ?? [],
  } satisfies StoredUnits);

/**
 * A row written before equipment was stored has no `heroEquipment` key. That
 * is left absent rather than defaulted to `[]`: absent and empty mean the same
 * to the analysis today, but only one of them is true.
 */
export const unpackUnits = (json: string): StoredUnits => {
  const u = JSON.parse(json) as StoredUnits;
  return { troops: u.troops, spells: u.spells, heroes: u.heroes, heroEquipment: u.heroEquipment };
};
