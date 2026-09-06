import { Bar, Chip, Res, pctTone } from './primitives';
import { GameIcon } from './GameIcon';
import { fmtDuration } from '@/lib/format';
import type { UnitProgress } from '@/lib/game/progress';

const HEAD = 'sticky top-0 bg-panel px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[.06em] text-muted';

export function UnitTable({ rows, th }: { rows: UnitProgress[]; th: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={`${HEAD} text-left`}>Unit</th>
            <th className={`${HEAD} text-right`}>Level</th>
            <th className={`${HEAD} text-left`}>Progress</th>
            <th className={`${HEAD} text-right`}>To max</th>
            <th className={`${HEAD} text-right`}>Lab time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line/40 last:border-0 hover:bg-panel-2">
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <GameIcon kind="unit" id={r.id} size={26} />
                  <span className={r.level >= r.maxHere ? 'text-ok' : undefined}>{r.name}</span>
                  {r.rushed && (
                    <Chip tone="bad" title={`Below the TH${th - 1} ceiling of ${r.prevMax}`}>rushed</Chip>
                  )}
                  {!r.found && <Chip title="Not unlocked on this account yet">locked</Chip>}
                </div>
              </td>
              <td className="num px-3 py-2 text-right">{r.level} / {r.maxHere}</td>
              <td className="px-3 py-2">
                <div className="min-w-[90px]"><Bar pct={r.pct} tone={pctTone(r.pct)} /></div>
              </td>
              <td className="px-3 py-2 text-right">
                {r.remainingCost > 0
                  ? <Res amount={r.remainingCost} kind={r.resource} est={r.est} />
                  : <span className="text-faint">—</span>}
              </td>
              <td className="num px-3 py-2 text-right text-muted">
                {r.remainingHours > 0 ? fmtDuration(r.remainingHours) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
