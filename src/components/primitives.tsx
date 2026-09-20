import type { ReactNode } from 'react';
import type { Currency, OreCost } from '@/lib/game/types';
import { fmtResource } from '@/lib/format';
import { ResourceIcon } from '@/components/GameIcon';
import { ORES } from '@/lib/game/equipment';
import type { Village } from '@/lib/sprites';

/**
 * The page's own banner: what this section of the store is, in the display
 * face, with the lookup that feeds it on the right.
 *
 * Every tool page opens with one so the four sections are recognisably the
 * same product. `action` is the slot the tag search drops into; on a phone it
 * wraps under the title and goes full width, because a search box squeezed
 * beside a heading is a search box nobody uses.
 */
export function PageHead({ title, sub, action }: {
  title: ReactNode; sub?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="shelf-title text-[28px] sm:text-[34px]">{title}</h1>
        {sub && <p className="mt-2 max-w-[66ch] text-[13px] text-muted">{sub}</p>}
      </div>
      <div className="flex-1" />
      {action}
    </div>
  );
}

/**
 * A shelf label — the heading over a row of tiles, with an optional link at
 * the far right the way the store puts "Learn more" beside a section.
 */
export function SectionHead({ title, sub, action }: {
  title: ReactNode; sub?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="mb-3.5 flex flex-wrap items-end gap-x-4 gap-y-1">
      <div>
        <h2 className="shelf-title text-[20px]">{title}</h2>
        {sub && <p className="mt-1 text-[13px] text-muted">{sub}</p>}
      </div>
      <div className="flex-1" />
      {action}
    </div>
  );
}

/**
 * The card everything on this site is served on.
 *
 * The title bar carries a short gold rule rather than a full border: the store
 * marks a card's heading with a bit of colour, and a full rule across a card
 * this wide cuts it in two.
 */
export function Panel({ title, action, children, tight }: {
  title?: ReactNode; action?: ReactNode; children: ReactNode; tight?: boolean;
}) {
  return (
    <section className="surface">
      {title && (
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <span aria-hidden className="h-4 w-1 rounded-full bg-gold" />
          <h2 className="display text-[15px]">{title}</h2>
          <div className="flex-1" />
          {action}
        </div>
      )}
      <div className={tight ? '' : 'p-4'}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone }: {
  label: string; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'warn' | 'bad';
}) {
  const color = tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : '';
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[11px] font-bold tracking-[.09em] text-muted uppercase">{label}</div>
      <div className={`num text-[25px] leading-tight font-bold tracking-tight ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-faint">{sub}</div>}
    </div>
  );
}

const BAR_TONE = {
  ok: 'bg-gradient-to-b from-ok to-ok/75',
  warn: 'bg-gradient-to-b from-warn to-warn/75',
  bad: 'bg-gradient-to-b from-bad to-bad/75',
  gold: 'bg-gradient-to-b from-[#ffd75a] to-[#f5a300]',
} as const;

/**
 * A progress bar with the weight the game's own bars have: a sunk track, a
 * filled bead with a highlight along its top, and enough height to be read
 * from across the room rather than squinted at.
 */
export function Bar({ pct, tone = 'gold' }: { pct: number; tone?: keyof typeof BAR_TONE }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full border border-line bg-panel-3 shadow-[inset_0_1px_2px_rgba(0,0,0,.35)]">
      <div
        className={`h-full rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,.45)] transition-[width] duration-300 ${BAR_TONE[tone]}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

/** Tone from completion percentage — used consistently for every progress bar. */
export const pctTone = (pct: number): keyof typeof BAR_TONE =>
  pct >= 99 ? 'ok' : pct >= 60 ? 'gold' : pct >= 30 ? 'warn' : 'bad';

const RES_COLOR: Record<Currency, string> = {
  gold: 'text-gold', elixir: 'text-elixir', dark: 'text-dark',
  shiny: 'text-shiny', glowy: 'text-glowy', starry: 'text-starry',
  sparky: 'text-sparky',
};

/**
 * A cost, badged with the game's own icon for the resource and coloured to
 * match. `est` renders the "≈" that marks a value as interpolated rather than
 * read from a published table. No dataset sets it today; it stays wired up so
 * that half-documented new content can be shown honestly — see
 * src/lib/game/curve.ts.
 *
 * Always a cost, never a balance: an amount you already hold is marked with the
 * storage that banks it. Same colour, different noun.
 *
 * `village` picks the currency's own art. Builder Gold and Builder Elixir are
 * different currencies from the home village's, not the same ones earned
 * elsewhere, and the game draws them differently.
 */
export function Res({ amount, kind, est, village = 'home' }: {
  amount: number; kind: Currency; est?: boolean; village?: Village;
}) {
  return (
    <span className={`num inline-flex items-center gap-1 whitespace-nowrap ${RES_COLOR[kind]}`}>
      <ResourceIcon kind={kind} village={village} />
      <span>
        {est && (
          <span className="est-mark" title="Interpolated estimate — not a verified in-game value">≈</span>
        )}
        {fmtResource(amount)}
      </span>
    </span>
  );
}

/**
 * An equipment upgrade's price: two or three ores at once, each with its own
 * badge.
 *
 * Rendered as a row of `Res` rather than a single figure because the ores are
 * not interchangeable — 600 Glowy is not 600 Shiny, and no exchange rate exists
 * between them — so adding them into one number would invent a currency the
 * game does not have. Ores an item never uses are absent from the cost and are
 * simply not drawn.
 */
export function OreRow({ cost, gap = 'gap-2' }: { cost: OreCost; gap?: string }) {
  const parts = ORES.filter((o) => cost[o]);
  if (!parts.length) return null;
  return (
    <span className={`inline-flex flex-wrap items-baseline ${gap}`}>
      {parts.map((o) => <Res key={o} amount={cost[o]!} kind={o} />)}
    </span>
  );
}

const TAG_TONE = {
  plain: 'text-text-2 border-line bg-panel-2',
  gold: 'text-gold border-gold/45 bg-gold/12',
  ok: 'text-ok border-ok/45 bg-ok/12',
  warn: 'text-warn border-warn/45 bg-warn/12',
  bad: 'text-bad border-bad/45 bg-bad/12',
  info: 'text-info border-info/45 bg-info/12',
} as const;

export function Chip({ tone = 'plain', title, children }: {
  tone?: keyof typeof TAG_TONE; title?: string; children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${TAG_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export function Banner({ tone = 'plain', children }: {
  tone?: 'plain' | 'warn' | 'bad'; children: ReactNode;
}) {
  const cls = tone === 'warn' ? 'border-warn/45 bg-warn/[.10]'
    : tone === 'bad' ? 'border-bad/45 bg-bad/[.10]'
    : 'border-line bg-panel-2';
  return (
    <div className={`flex items-start gap-2.5 rounded-[14px] border px-4 py-3 text-[13px] text-text-2 ${cls}`}>
      {children}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-5 py-12 text-center text-muted">
      <h3 className="display mb-1.5 text-[18px] text-text-2">{title}</h3>
      {children}
    </div>
  );
}
