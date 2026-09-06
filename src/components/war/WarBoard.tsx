import { Bar, Chip, Panel, Stat } from '../primitives';
import { fmtRelative } from '@/lib/format';
import type { SideSummary, WarAnalysis, WarMemberRow } from '@/lib/war/types';

const HEAD = 'sticky top-0 bg-panel px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[.06em] text-muted';
const CELL = 'px-3 py-2';

const STATE_LABEL: Record<string, string> = {
  preparation: 'Preparation day',
  inWar: 'Battle day',
  warEnded: 'War ended',
  notInWar: 'Not in war',
};

export function WarBoard({ war }: { war: WarAnalysis }) {
  const tone = war.standing === 'ahead' ? 'ok' : war.standing === 'behind' ? 'bad' : undefined;
  const prep = war.state === 'preparation';

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <Stat
            label="Stars"
            value={`${war.us.stars} – ${war.them.stars}`}
            tone={tone}
            sub={prep ? 'battle has not started' : war.standing}
          />
        </Panel>
        <Panel>
          <Stat
            label="Destruction"
            value={`${war.us.destruction.toFixed(1)}%`}
            sub={`opponent ${war.them.destruction.toFixed(1)}%`}
          />
        </Panel>
        <Panel>
          <Stat
            label="Attacks used"
            value={`${war.attacksUsed}/${war.attacksTotal}`}
            tone={war.outstanding ? 'warn' : 'ok'}
            sub={`${war.outstanding} outstanding`}
          />
        </Panel>
        <Panel>
          <Stat
            label={prep ? 'Battle starts' : 'War ends'}
            value={fmtRelative(prep ? war.startTime : war.endTime)}
            sub={`${war.teamSize} v ${war.teamSize} · ${war.attacksPerMember} ${war.attacksPerMember === 1 ? 'attack' : 'attacks'} each`}
          />
        </Panel>
      </div>

      <Panel
        title={`${war.us.name || 'Our clan'} vs ${war.them.name}`}
        action={<Chip tone={prep ? 'info' : war.state === 'inWar' ? 'gold' : 'plain'}>
          {STATE_LABEL[war.state] ?? war.state}
        </Chip>}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <SideSpread label="Us" side={war.us} />
          <SideSpread label="Them" side={war.them} />
        </div>
      </Panel>

      {!prep && (war.missing.length ? (
        <Panel
          title="Attacks not used"
          action={<Chip tone="bad">{war.outstanding} hits outstanding</Chip>}
          tight
        >
          <MissingTable rows={war.missing} />
        </Panel>
      ) : (
        <Panel>
          <p className="text-[13px] text-ok">Every attack has been used. Nothing outstanding.</p>
        </Panel>
      ))}

      <Panel title="Our war map" tight>
        <RosterTable rows={war.rows} prep={prep} />
      </Panel>
    </>
  );
}

function SideSpread({ label, side }: { label: string; side: SideSummary }) {
  // Scaled against the biggest bucket, not the roster size: with nine Town Hall
  // levels across forty members every bar would otherwise be a stub, and the
  // shape of the matchup — which is the whole point — would be unreadable.
  const peak = Math.max(1, ...side.spread.map(([, n]) => n));
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="text-[13px] text-muted">{side.name}</span>
      </div>
      {side.spread.length ? (
        <div className="grid gap-1.5">
          {side.spread.map(([th, n]) => (
            <div key={th} className="flex items-center gap-2.5">
              <div className="w-[54px] text-xs text-muted">TH{th}</div>
              <div className="flex-1"><Bar pct={(n / peak) * 100} /></div>
              <div className="num w-8 text-right text-xs">{n}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-faint">Roster not published.</p>
      )}
    </div>
  );
}

function MissingTable({ rows }: { rows: WarMemberRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={`${HEAD} w-12 text-right`}>#</th>
            <th className={`${HEAD} text-left`}>Player</th>
            <th className={`${HEAD} w-16 text-right`}>TH</th>
            <th className={`${HEAD} w-24 text-right`}>Unused</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.tag} className="border-b border-line/40 last:border-0 hover:bg-panel-2">
              <td className={`num ${CELL} text-right text-faint`}>{r.mapPosition}</td>
              <td className={CELL}>
                <a href={`/player/${r.tag.slice(1)}`} className="hover:text-info hover:underline">{r.name}</a>
              </td>
              <td className={`num ${CELL} text-right`}>{r.townHallLevel}</td>
              <td className={`num ${CELL} text-right font-semibold text-bad`}>{r.unused}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RosterTable({ rows, prep }: { rows: WarMemberRow[]; prep: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={`${HEAD} text-right`}>#</th>
            <th className={`${HEAD} text-left`}>Player</th>
            <th className={`${HEAD} text-right`}>TH</th>
            <th className={`${HEAD} text-right`}>Hits</th>
            <th className={`${HEAD} text-right`} title="Stars this member added to the war — a cleanup hit on a base that was already three-starred counts for nothing">Stars added</th>
            <th className={`${HEAD} text-right`}>Best %</th>
            <th className={`${HEAD} text-right`}>Defended</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.tag} className="border-b border-line/40 last:border-0 hover:bg-panel-2">
              <td className={`num ${CELL} text-right text-faint`}>{r.mapPosition}</td>
              <td className={CELL}>
                <a href={`/player/${r.tag.slice(1)}`} className="hover:text-info hover:underline">{r.name}</a>
              </td>
              <td className={`num ${CELL} text-right`}>{r.townHallLevel}</td>
              <td className={`num ${CELL} text-right ${r.unused ? 'text-warn' : 'text-muted'}`}>
                {prep ? '—' : `${r.attacksUsed}/${r.attacksAllowed}`}
              </td>
              {/* Stars *added*, so two attacks can be worth up to six — a
                  three-star glyph row would be the wrong shape entirely. */}
              <td className={`num ${CELL} text-right`}>
                {prep ? '—' : <span className={r.stars ? 'text-gold' : 'text-faint'}>{r.stars}★</span>}
              </td>
              <td className={`num ${CELL} text-right`}>
                {prep || !r.attacksUsed ? '—' : `${r.bestDestruction.toFixed(0)}%`}
              </td>
              <td className={`num ${CELL} text-right text-muted`}>
                {r.defenseStars === null
                  ? <span className="text-ok">clean</span>
                  : `${r.defenseStars}★ / ${r.defenseDestruction?.toFixed(0)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
