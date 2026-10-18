import type { ReactNode } from 'react';
import type { Currency, OreCost } from '@/lib/game/types';
import { fmtResource } from '@/lib/format';
import { ResourceIcon } from '@/components/GameIcon';
import { ORES } from '@/lib/game/equipment';
import type { Village } from '@/lib/sprites';

/**
 * A section's opening line: what this part of the programme is, in the
 * headline face, with the lookup that feeds it on the right.
 *
 * Every tool page opens with one so the sections are recognisably the same
 * publication. `action` is the slot the tag search drops into; on a phone it
 * wraps under the title, because a search box squeezed beside a heading is a
 * search box nobody uses.
 */
export function PageHead({ title, sub, action }: {
  title: ReactNode; sub?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-line pb-5">
      <div className="min-w-0">
        <h1 className="shelf-title text-[40px] sm:text-[56px]">{title}</h1>
        {sub && <p className="mt-3 max-w-[66ch] text-[15px] text-text-2">{sub}</p>}
      </div>
      <div className="flex-1" />
      {action}
    </div>
  );
}

/** A heading over a run of content, with an optional link at the far right. */
export function SectionHead({ title, sub, action }: {
  title: ReactNode; sub?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-1">
      <div>
        <h2 className="shelf-title text-[30px]">{title}</h2>
        {sub && <p className="mt-1.5 text-[14px] text-muted">{sub}</p>}
      </div>
      <div className="flex-1" />
      {action}
    </div>
  );
}

/**
 * A section of the page.
 *
 * It starts under a heavy ink rule and names itself in caps, the way a table
 * does in an almanac. The rule is the container; there is no box.
 */
export function Panel({ title, action, children, tight }: {
  title?: ReactNode; action?: ReactNode; children: ReactNode; tight?: boolean;
}) {
  return (
    <section className="surface">
      {title && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2.5">
          <h2 className="display text-[19px] leading-tight">{title}</h2>
          <div className="flex-1" />
          {action}
        </div>
      )}
      <div className={tight ? '' : 'p-4'}>{children}</div>
    </section>
  );
}

/**
 * A run of figures under one rule, divided by hairlines: how an almanac sets a
 * team's numbers, as one line rather than a row of boxes. `inset` drops the
 * rule for a run that already sits inside a section.
 */
export function StatLine({ children, inset }: { children: ReactNode; inset?: boolean }) {
  return <div className={inset ? 'stat-line' : 'surface stat-line'}>{children}</div>;
}

/**
 * The scoreline: two figures with a small "v" between them, the first in the
 * accent. The cover sets the sample village this way, the war page the stars,
 * the player band the levels.
 */
export function Score({ a, b, className = '' }: { a: string; b: string; className?: string }) {
  return (
    <span className={`shelf-title inline-flex flex-wrap items-end gap-x-[.18em] leading-[.82] ${className}`}>
      <span className="text-gold">{a}</span>
      <span className="pb-[.12em] text-[.34em]">v</span>
      <span>{b}</span>
    </span>
  );
}

/** The star a war is scored in, drawn rather than typed. */
export function StarMark() {
  return (
    <svg viewBox="0 0 20 20" aria-label="stars" role="img"
      className="ml-[.12em] inline-block h-[.85em] w-[.85em] -translate-y-[.06em] fill-current align-baseline">
      <path d="M10 1.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L10 15l-5.4 2.9 1.1-6.1L1.2 7.6l6.1-.8z" />
    </svg>
  );
}

export function Stat({ label, value, sub, tone }: {
  label: string; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'warn' | 'bad';
}) {
  const color = tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : '';
  return (
    <div className="flex flex-col gap-0.5">
      <div className="display text-[13px] text-muted">{label}</div>
      <div className={`display text-[44px] leading-none font-black tabular-nums ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

type BarTone = 'ok' | 'warn' | 'bad' | 'gold';

/**
 * A progress bar. Left is level one, right is the ceiling. What is done is
 * solid and what remains is hatched, so the bar still reads with its colour
 * taken away. `count` draws a tally instead, for a distribution: a count has
 * nothing left to do, so its track is plain.
 */
export function Bar({ pct, tone = 'gold', count }: { pct: number; tone?: BarTone; count?: boolean }) {
  return (
    <div className="bar-track" data-kind={count ? 'count' : undefined}>
      <div
        className="bar-fill"
        data-tone={tone}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

/** Tone from completion percentage — used consistently for every progress bar. */
export const pctTone = (pct: number): BarTone =>
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

type ChipTone = 'plain' | 'gold' | 'ok' | 'warn' | 'bad' | 'info';

/** A result box. The tone changes the border as well as the colour. */
export function Chip({ tone = 'plain', title, children }: {
  tone?: ChipTone; title?: string; children: ReactNode;
}) {
  return <span title={title} className="chip" data-tone={tone}>{children}</span>;
}

export function Banner({ tone = 'plain', children }: {
  tone?: 'plain' | 'warn' | 'bad'; children: ReactNode;
}) {
  const cls = tone === 'warn' ? 'border-warn border-dashed'
    : tone === 'bad' ? 'border-bad'
    : 'border-line-2';
  return (
    <div className={`flex items-start gap-2.5 border-2 bg-panel px-4 py-3 text-[14px] text-text-2 ${cls}`}>
      {children}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-5 py-12 text-center text-muted">
      <h3 className="display mb-2 text-[26px] text-text">{title}</h3>
      {children}
    </div>
  );
}
