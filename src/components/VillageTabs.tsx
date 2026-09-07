import Link from 'next/link';
import type { VillageId } from '@/lib/store';

export const VILLAGE_LABEL: Record<VillageId, string> = {
  home: 'Home Village',
  builder: 'Builder Base',
};

export interface VillageTab {
  id: VillageId;
  /** A link for page-per-village surfaces; omit for ones that switch in place. */
  href?: string;
  /** Shown under the label — a hall level, or why the village is unavailable. */
  sub?: string;
  disabled?: boolean;
}

const base =
  'rounded-[10px] border px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition';
const on = 'border-gold-2 bg-gold text-ink';
const off = 'border-line text-text-2 hover:bg-panel-2 hover:text-text';
const dead = 'border-line/60 text-faint cursor-not-allowed';

/**
 * The Home Village / Builder Base switch.
 *
 * Every surface that shows village-specific numbers carries one, in the same
 * place, so which village you are looking at is answered before you read a
 * single figure. The two are never shown at once: they have separate halls,
 * separate currencies and separate progress, and stacking them on one screen is
 * what made the old player page read as one village with a strange appendix.
 *
 * `onSelect` switches in place, `href` navigates. The player pages want a URL
 * per village so each is linkable and indexable; the planner and the base
 * builder are one tool applied to two villages, so they switch in place.
 */
export function VillageTabs({ active, tabs, onSelect }: {
  active: VillageId;
  tabs: VillageTab[];
  onSelect?: (id: VillageId) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Village">
      {tabs.map((t) => {
        const selected = t.id === active;
        const cls = `${base} ${t.disabled ? dead : selected ? on : off}`;
        const body = (
          <span className="flex items-baseline gap-1.5">
            {VILLAGE_LABEL[t.id]}
            {t.sub && (
              <span className={`num text-[11px] font-bold ${selected ? 'text-ink/70' : 'text-faint'}`}>
                {t.sub}
              </span>
            )}
          </span>
        );

        if (t.disabled) {
          return <span key={t.id} className={cls} aria-disabled>{body}</span>;
        }
        if (t.href && !onSelect) {
          return (
            <Link key={t.id} href={t.href} role="tab" aria-selected={selected} className={cls}>
              {body}
            </Link>
          );
        }
        return (
          <button
            key={t.id} type="button" role="tab" aria-selected={selected} className={cls}
            onClick={() => onSelect?.(t.id)}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}
