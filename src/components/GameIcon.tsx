import Image from 'next/image';
import type { Resource } from '@/lib/game/types';
import {
  buildingSpriteUrl, resourceSpriteUrl, unitSpriteUrl, STORAGE_ID, type Village,
} from '@/lib/sprites';

/**
 * Official art for a structure or a unit, at a size that suits a table row.
 *
 * Structures are drawn at a level because the game draws them at a level; units
 * get their fixed portrait, the same one the Laboratory shows. See
 * src/lib/sprites for why the two are indexed differently.
 *
 * Art can be missing — a unit added to the tables before its sprite is fetched
 * — so this always renders a box of the same size. A row that silently loses
 * its icon would shift every column beside it.
 */
export function GameIcon({ kind, id, level, village = 'home', size = 26, alt = '' }: {
  kind: 'building' | 'unit';
  id: string;
  /** Required for buildings; ignored for units. */
  level?: number;
  village?: Village;
  size?: number;
  alt?: string;
}) {
  const url = kind === 'building'
    ? buildingSpriteUrl(id, level ?? 1)
    : unitSpriteUrl(id, village);

  if (!url) {
    return (
      <span
        aria-hidden
        className="shrink-0 rounded-[4px] border border-line bg-panel-2"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <Image
      src={url}
      alt={alt}
      width={size}
      height={size}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

export const RESOURCE_NAME: Record<Resource, string> = {
  gold: 'Gold', elixir: 'Elixir', dark: 'Dark elixir',
};

/**
 * The game's own badge for a resource — the coin, the elixir drop, the dark
 * drop — marking a cost.
 *
 * Sized in `em` rather than pixels so one component serves a 13px table cell
 * and a 23px headline figure without either being told a number. It is named,
 * not decorative: in a cost column the colour is otherwise the only thing
 * separating gold from elixir, and colour alone is not a label.
 */
export function ResourceIcon({ kind, em = 1.05 }: { kind: Resource; em?: number }) {
  const url = resourceSpriteUrl(kind);
  if (!url) return null;
  return (
    <Image
      src={url}
      alt={RESOURCE_NAME[kind]}
      width={40}
      height={40}
      className="shrink-0 object-contain"
      style={{ width: `${em}em`, height: `${em}em` }}
    />
  );
}

/**
 * The storage that banks a resource, drawn at the level the given Town Hall
 * reaches — the marker for an amount you *hold*, as opposed to one you owe.
 *
 * Below TH7 there is no Dark Elixir Storage, and at TH1 no storage at all is
 * built yet, so this falls back to the resource badge rather than leaving a
 * hole where a label's icon should be.
 */
export function StorageIcon({ kind, level, size = 22 }: {
  kind: Resource;
  /** The storage's level, or null where the Town Hall has no such storage. */
  level: number | null;
  size?: number;
}) {
  const url = level == null ? null : buildingSpriteUrl(STORAGE_ID[kind], level);
  if (!url) return <ResourceIcon kind={kind} em={size / 16} />;
  return (
    <Image
      src={url}
      alt={`${RESOURCE_NAME[kind]} storage`}
      width={size}
      height={size}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}
