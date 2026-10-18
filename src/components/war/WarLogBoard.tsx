import { Panel, Stat, StatLine } from '../primitives';
import { fmtRelative } from '@/lib/format';
import type { WarLogEntry, WarLogSummary } from '@/lib/war/types';

const HEAD = 'sticky top-0 bg-panel px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[.06em] text-muted';
const CELL = 'px-3 py-2';

const RESULT_TONE: Record<WarLogEntry['result'], string> = {
  win: 'border-ok bg-ok text-bg',
  lose: 'border-bad text-bad',
  tie: 'border-dashed border-line-2 text-muted',
};
const RESULT_LETTER: Record<WarLogEntry['result'], string> = { win: 'W', lose: 'L', tie: 'T' };

export function WarLogBoard({ entries, summary }: { entries: WarLogEntry[]; summary: WarLogSummary }) {
  return (
    <>
      <StatLine>
        <div>
          <Stat
            label="Record"
            value={`${summary.wins}–${summary.losses}${summary.ties ? `–${summary.ties}` : ''}`}
            sub={`last ${summary.wars} wars`}
          />
        </div>
        <div>
          <Stat
            label="Win rate"
            value={`${summary.winRate.toFixed(0)}%`}
            tone={summary.winRate >= 60 ? 'ok' : summary.winRate >= 40 ? 'warn' : 'bad'}
            sub={`best run ${summary.bestStreak} in a row`}
          />
        </div>
        <div><Stat label="Avg stars" value={summary.avgStars.toFixed(1)} sub="per war" /></div>
        <div><Stat label="Avg destruction" value={`${summary.avgDestruction.toFixed(1)}%`} /></div>
      </StatLine>

      <Panel title="Recent form" action={<span className="text-[11px] text-faint">newest first</span>}>
        <div className="flex flex-wrap gap-1">
          {entries.map((e, i) => (
            <div
              key={`${e.endTime}-${i}`}
              title={`${e.result} vs ${e.opponentName} — ${e.stars} stars v ${e.opponentStars}`}
              className={`display grid h-6 w-6 place-items-center border-2 text-[12px] ${RESULT_TONE[e.result]}`}
            >
              {RESULT_LETTER[e.result]}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="War history" tight>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={`${HEAD} text-left`}>Result</th>
                <th className={`${HEAD} text-left`}>Opponent</th>
                <th className={`${HEAD} text-right`}>Size</th>
                <th className={`${HEAD} text-right`}>Stars</th>
                <th className={`${HEAD} text-right`}>Destruction</th>
                <th className={`${HEAD} text-right`}>Ended</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={`${e.endTime}-${i}`} className="border-b border-line/40 last:border-0 hover:bg-panel-2">
                  <td className={CELL}>
                    <span className={`display inline-flex border-2 px-2 text-[12px] ${RESULT_TONE[e.result]}`}>
                      {e.result}
                    </span>
                  </td>
                  <td className={CELL}>
                    {e.opponentTag
                      ? <a href={`/clan/${e.opponentTag.slice(1)}`} className="hover:text-info hover:underline">{e.opponentName}</a>
                      : e.opponentName}
                  </td>
                  <td className={`num ${CELL} text-right text-muted`}>{e.teamSize}v{e.teamSize}</td>
                  <td className={`num ${CELL} text-right`}>
                    <span className={e.stars > e.opponentStars ? 'text-ok' : e.stars < e.opponentStars ? 'text-bad' : ''}>
                      {e.stars}
                    </span>
                    <span className="text-faint"> – {e.opponentStars}</span>
                  </td>
                  <td className={`num ${CELL} text-right text-muted`}>
                    {e.destruction.toFixed(1)}% – {e.opponentDestruction.toFixed(1)}%
                  </td>
                  <td className={`num ${CELL} text-right text-muted`}>{fmtRelative(e.endTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
