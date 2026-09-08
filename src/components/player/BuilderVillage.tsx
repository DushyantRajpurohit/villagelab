import { Bar, Chip, Panel, Res, Stat, pctTone } from '@/components/primitives';
import { GameIcon, RESOURCE_NAME } from '@/components/GameIcon';
import { HeroRoster } from '@/components/HeroRoster';
import { fmtDuration } from '@/lib/format';
import { MAX_BH } from '@/lib/game/builder-base';
import type { BuilderProgressSummary, BuilderUnitProgress } from '@/lib/game/progress';

const HEAD = 'sticky top-0 bg-panel px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[.06em] text-muted';
const CELL = 'px-3 py-2';

/**
 * The second village's own page body.
 *
 * Costs here are Builder Elixir and Builder Gold. They are shown with the same
 * components as the Home Village because they are the same kind of number — but
 * they are never added to a Home Village total, because they are not the same
 * currency. See src/lib/game/builder-base.ts.
 *
 * No figure on this page is an estimate: the Builder Base's costs are published
 * per level, so there is no "≈" to explain away. The Home Village is read the
 * same way now, structures and units alike.
 */
export function BuilderVillage({ bh, summary }: {
  bh: number;
  summary: BuilderProgressSummary;
}) {
  const { rows } = summary;
  const troops = rows.filter((r) => r.kind === 'troop');
  const heroes = rows.filter((r) => r.kind === 'hero');
  const rushed = rows.filter((r) => r.rushed);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <Stat label="Army progress" value={`${summary.overallPct.toFixed(0)}%`}
            sub={`${summary.maxedCount} of ${rows.length} maxed for BH${bh}`} />
          <div className="mt-2.5"><Bar pct={summary.overallPct} tone={pctTone(summary.overallPct)} /></div>
        </Panel>
        <Panel>
          <Stat label="Rushed units" value={String(summary.rushedCount)}
            tone={summary.rushedCount ? 'bad' : 'ok'}
            sub={summary.rushedCount ? `below the BH${bh - 1} ceiling` : 'nothing left behind'} />
        </Panel>
        <Panel>
          <Stat label="Star Lab time left" value={fmtDuration(summary.totalHours)}
            sub="one laboratory, sequential" />
        </Panel>
        <Panel>
          <Stat label="Builder Hall" value={`BH${bh}`}
            sub={bh >= MAX_BH ? 'maximum' : `${MAX_BH - bh} to go`} />
        </Panel>
      </div>

      <Panel title={`Cost to max the army at BH${bh}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['elixir', 'gold'] as const)
            .filter((k) => summary.cost[k] > 0)
            .map((k) => (
              <div key={k}>
                <div className="text-[11px] uppercase tracking-[.06em] text-muted">
                  Builder {RESOURCE_NAME[k]}
                </div>
                <div className="text-[22px] font-semibold"><Res amount={summary.cost[k]} kind={k} village="builder" /></div>
              </div>
            ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          Star Laboratory and hero upgrades only, and every figure is a published value rather than
          an estimate. The API does not expose building levels — record those in the planner.
        </p>
      </Panel>

      {rushed.length > 0 && (
        <Panel title="Rushed — behind the previous Builder Hall"
          action={<Chip tone="bad">{rushed.length} unit{rushed.length === 1 ? '' : 's'}</Chip>} tight>
          <BuilderTable rows={[...rushed].sort((a, b) => b.remainingCost - a.remainingCost)} />
        </Panel>
      )}

      {heroes.length > 0 && (
        <Panel title="Heroes" tight
          action={<Chip tone={heroes.every((h) => h.level >= h.maxHere) ? 'ok' : 'plain'}>
            {heroes.filter((h) => h.level >= h.maxHere).length}/{heroes.length} maxed
          </Chip>}>
          {/* The same hall treatment as the home village: two heroes here
              rather than five, but they are the same kind of thing. */}
          <HeroRoster heroes={heroes} hall={bh} village="builder" hallShort="BH" />
        </Panel>
      )}

      {troops.length > 0 && (
        <Panel title="Troops" tight
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
            <th className={`${HEAD} text-right`}>To max</th>
            <th className={`${HEAD} text-right`}>Time</th>
            <th className={`${HEAD} text-right`}>Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-b border-line/40 last:border-0 hover:bg-panel-2">
              <td className={CELL}>
                <div className="flex items-center gap-2">
                  {/* Builder village: the two villages share unit ids but not
                      their art, so the village has to be named explicitly. */}
                  <GameIcon kind="unit" id={r.id} village="builder" size={26} />
                  <span>{r.name}</span>
                </div>
              </td>
              <td className={`num ${CELL} text-right whitespace-nowrap`}>
                <span className={r.level >= r.maxHere ? 'text-ok' : ''}>{r.level}</span>
                <span className="text-faint"> / {r.maxHere}</span>
              </td>
              <td className={`${CELL} w-1/3`}>
                <Bar pct={r.pct} tone={pctTone(r.pct)} />
              </td>
              <td className={`${CELL} text-right`}>
                {r.remainingCost ? <Res amount={r.remainingCost} kind={r.resource} village="builder" /> : <span className="text-faint">—</span>}
              </td>
              <td className={`num ${CELL} text-right text-muted`}>
                {r.remainingHours ? fmtDuration(r.remainingHours) : '—'}
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
