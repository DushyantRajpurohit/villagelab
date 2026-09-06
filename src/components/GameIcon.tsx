import Image from 'next/image';
import { buildingSpriteUrl, unitSpriteUrl, type Village } from '@/lib/sprites';

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
