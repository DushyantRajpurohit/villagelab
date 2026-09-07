import type { ReactNode } from 'react';
import type { Resource } from '@/lib/game/types';
import { fmtResource } from '@/lib/format';
import { ResourceIcon } from '@/components/GameIcon';
import type { Village } from '@/lib/sprites';

export function Panel({ title, action, children, tight }: {
  title?: ReactNode; action?: ReactNode; children: ReactNode; tight?: boolean;
}) {
  return (
    <section className="surface">
      {title && (
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
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
      <div className="text-[11px] font-semibold uppercase tracking-[.07em] text-muted">{label}</div>
      <div className={`num text-[23px] font-bold leading-tight tracking-tight ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-faint">{sub}</div>}
    </div>
  );
}

const BAR_TONE = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', gold: 'bg-gold' } as const;

export function Bar({ pct, tone = 'gold' }: { pct: number; tone?: keyof typeof BAR_TONE }) {
  return (
    <div className="h-2 overflow-hidden rounded-full border border-line bg-panel-3">
      <div
        className={`h-full rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,.35)] transition-[width] duration-300 ${BAR_TONE[tone]}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

/** Tone from completion percentage — used consistently for every progress bar. */
export const pctTone = (pct: number): keyof typeof BAR_TONE =>
  pct >= 99 ? 'ok' : pct >= 60 ? 'gold' : pct >= 30 ? 'warn' : 'bad';

const RES_COLOR: Record<Resource, string> = {
  gold: 'text-gold', elixir: 'text-elixir', dark: 'text-dark',
};

/**
 * A cost, badged with the game's own icon for the resource and coloured to
 * match. `est` renders the "≈" that marks every value interpolated rather than
 * anchored — see src/lib/game/curve.ts.
 *
 * Always a cost, never a balance: an amount you already hold is marked with the
 * storage that banks it. Same colour, different noun.
 *
 * `village` picks the currency's own art. Builder Gold and Builder Elixir are
 * different currencies from the home village's, not the same ones earned
 * elsewhere, and the game draws them differently.
 */
export function Res({ amount, kind, est, village = 'home' }: {
  amount: number; kind: Resource; est?: boolean; village?: Village;
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

const TAG_TONE = {
  plain: 'text-text-2 border-line bg-panel-2',
  gold: 'text-gold border-gold/40 bg-gold/10',
  ok: 'text-ok border-ok/40 bg-ok/10',
  warn: 'text-warn border-warn/40 bg-warn/10',
  bad: 'text-bad border-bad/40 bg-bad/10',
  info: 'text-info border-info/40 bg-info/10',
} as const;

export function Chip({ tone = 'plain', title, children }: {
  tone?: keyof typeof TAG_TONE; title?: string; children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${TAG_TONE[tone]}`}
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
    <div className={`flex items-start gap-2.5 rounded-[10px] border px-3.5 py-2.5 text-[13px] text-text-2 ${cls}`}>
      {children}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-5 py-10 text-center text-muted">
      <h3 className="display mb-1.5 text-[17px] text-text-2">{title}</h3>
      {children}
    </div>
  );
}
