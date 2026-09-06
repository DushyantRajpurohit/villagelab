import { Bar, Chip, Panel, Stat, pctTone } from './primitives';
import { fmtInt } from '@/lib/format';
import { BUILDER_CEILINGS_VERIFIED, MAX_BH } from '@/lib/game/builder-base';
import type { BuilderProgressSummary, BuilderUnitProgress } from '@/lib/game/progress';

const HEAD = 'sticky top-0 bg-panel px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[.06em] text-muted';
const CELL = 'px-3 py-2';

/**
 * The second village.
 *
 * Levels and ceilings only — no cost column, because there is no Builder Base
 * cost data worth showing yet. See src/lib/game/builder-base.ts.
 */
export function BuilderBase({ bh, trophies, bestTrophies, summary }: {
  bh: number;
  trophies?: number;
  bestTrophies?: number;
  summary: BuilderProgressSummary;
}) {
  const { rows } = summary;
  const troops = rows.filter((r) => r.kind === 'troop');
  const heroes = rows.filter((r) => r.kind === 'hero');

  return (
    <>
      <Panel
        title="Builder Base"
        action={<Chip tone="gold">BH{bh}{bh >= MAX_BH ? ' · max' : ''}</Chip>}
      >
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Builder Hall" value={`BH${bh}`} sub={bh >= MAX_BH ? 'maximum' : `${MAX_BH - bh} to go`} />
          <Stat label="Builder trophies" value={trophies != null ? fmtInt(trophies) : '—'}
            sub={bestTrophies != null ? `best ${fmtInt(bestTrophies)}` : undefined} />
          <Stat label="Army progress" value={`${summary.overallPct.toFixed(0)}%`}
            sub={`${summary.maxedCount} of ${rows.length} maxed for BH${bh}`} />
          <Stat label="Rushed units" value={String(summary.rushedCount)}
            tone={summary.rushedCount ? 'bad' : 'ok'}
            sub={summary.rushedCount ? 'behind the previous hall' : 'nothing left behind'} />
        </div>

        <div className="mt-4"><Bar pct={summary.overallPct} tone={pctTone(summary.overallPct)} /></div>

        {!BUILDER_CEILINGS_VERIFIED && (
          <p className="mt-3 text-xs text-muted">
            Builder Base level ceilings follow the game&rsquo;s standard progression rather than a
            verified per-troop table, so treat the percentages as close rather than exact. Upgrade
            costs are not shown at all — we would be guessing, and a guess in a cost column reads
            like a fact.
          </p>
        )}
      </Panel>

      {heroes.length > 0 && (
        <Panel title="Builder Base heroes" tight
          action={<Chip tone={heroes.every((h) => h.level >= h.maxHere) ? 'ok' : 'plain'}>
            {heroes.filter((h) => h.level >= h.maxHere).length}/{heroes.length} maxed
          </Chip>}>
          <BuilderTable rows={heroes} />
        </Panel>
      )}

      {troops.length > 0 && (
        <Panel title="Builder Base troops" tight
          action={<Chip tone={troops.every((t) => t.level >= t.maxHere) ? 'ok' : 'plain'}>
            {troops.filter((t) => t.level >= t.maxHere).length}/{troops.length} maxed
          </Chip>}>
          <BuilderTable rows={troops} />
        </Panel>
      )}
    </>
  );
}

function BuilderTable({ rows }: { rows: BuilderUnitProgress[] }) {
  const sorted = [...rows].sort((a, b) => a.pct - b.pct);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={`${HEAD} text-left`}>Unit</th>
            <th className={`${HEAD} text-right`}>Level</th>
            <th className={`${HEAD} text-left`}>Progress</th>
            <th className={`${HEAD} text-right`}>Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-b border-line/40 last:border-0 hover:bg-panel-2">
              <td className={CELL}>{r.name}</td>
              <td className={`num ${CELL} text-right whitespace-nowrap`}>
                <span className={r.level >= r.maxHere ? 'text-ok' : ''}>{r.level}</span>
                <span className="text-faint"> / {r.maxHere}</span>
              </td>
              <td className={`${CELL} w-1/2`}>
                <Bar pct={r.pct} tone={pctTone(r.pct)} />
              </td>
              <td className={`${CELL} text-right`}>
                {/* "Not unlocked" and "level 0" are different facts; the API
                    simply omits a unit the account has never built. */}
                {!r.found ? <Chip tone="plain">locked</Chip>
                  : r.rushed ? <Chip tone="bad">rushed</Chip>
                  : r.level >= r.maxHere ? <Chip tone="ok">max</Chip>
                  : <span className="num text-muted">{r.pct.toFixed(0)}%</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
