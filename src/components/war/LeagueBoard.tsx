import { Chip, Panel, Stat } from '../primitives';
import { fmtRelative } from '@/lib/format';
import { WIN_BONUS } from '@/lib/war/league';
import type {
  LeagueAnalysis, LeagueMemberSeason, LeagueRound, LeagueStanding, RoundStatus, WarMemberRow,
} from '@/lib/war/types';

const HEAD = 'sticky top-0 bg-panel px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[.06em] text-muted';
const CELL = 'px-3 py-2';

const ROUND_LABEL: Record<RoundStatus, string> = {
  unscheduled: 'Not drawn yet',
  pending: 'Drawn',
  preparation: 'Preparation day',
  inWar: 'Battle day',
  warEnded: 'Ended',
  bye: 'No war this round',
};

const RESULT_TONE = {
  win: 'border-ok/40 bg-ok/10 text-ok',
  lose: 'border-bad/40 bg-bad/10 text-bad',
  tie: 'border-line bg-panel-3 text-muted',
} as const;

/** `2026-09` → "September 2026". */
function fmtSeason(season: string): string {
  const d = new Date(`${season}-01T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? season
    : d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const record = (s: Pick<LeagueStanding, 'wins' | 'losses' | 'ties'>) =>
  `${s.wins}–${s.losses}${s.ties ? `–${s.ties}` : ''}`;

export function LeagueBoard({ league }: { league: LeagueAnalysis }) {
  const us = league.us;
  const ended = league.state === 'ended';
  // Before the first battle day every clan is on nothing, and the order is
  // only the alphabetical tiebreak. A place then would be a number that means
  // nothing, so none is shown.
  const started = league.rounds.some((r) => r.status === 'inWar' || r.status === 'warEnded');

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <Stat
            label={ended ? 'Final place' : 'Group place'}
            value={us && started ? `#${us.rank}` : '—'}
            sub={`${started ? `of ${league.groupSize} clans` : 'from the first battle day'} · ${fmtSeason(league.season)}`}
          />
        </Panel>
        <Panel>
          <Stat
            label="League stars"
            value={us ? String(us.stars) : '—'}
            sub={us?.bonus ? `${us.bonus} of them win bonuses` : 'no win bonus yet'}
          />
        </Panel>
        <Panel>
          <Stat
            label="Record"
            value={us ? record(us) : '—'}
            sub={`${league.roundsPlayed} of ${league.roundsTotal} wars finished`}
          />
        </Panel>
        <Panel>
          <Stat
            label="Attacks used"
            value={String(league.attacksUsed)}
            tone={league.attacksMissed ? 'warn' : 'ok'}
            sub={`${league.attacksMissed} missed${league.attacksOwed ? ` · ${league.attacksOwed} still to use` : ''}`}
          />
        </Panel>
      </div>

      {league.live && (
        <Panel
          title={`Round ${league.live.round} vs ${league.live.opponent}`}
          action={
            <Chip tone={league.live.owing.length ? 'bad' : 'ok'}>
              {league.live.owing.length ? `${league.live.owing.length} still to attack` : 'all attacked'}
            </Chip>
          }
          tight
        >
          {league.live.owing.length ? (
            <OwingTable rows={league.live.owing} />
          ) : (
            <p className="p-4 text-[13px] text-ok">Everyone in this round&rsquo;s lineup has attacked.</p>
          )}
          <p className="border-t border-line px-4 py-2.5 text-[11px] text-faint">
            Battle day ends {fmtRelative(league.live.endTime)}. One attack each in a league war.
          </p>
        </Panel>
      )}

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Panel title="Group standings"
          action={<Chip tone={ended ? 'plain' : started ? 'gold' : 'info'}>{ended ? 'Final' : started ? 'Live' : 'Not started'}</Chip>}
          tight>
          <StandingsTable rows={league.standings} clanTag={league.clanTag} ranked={started} />
          <p className="border-t border-line px-4 py-2.5 text-[11px] text-faint">
            Ranked on stars, with {WIN_BONUS} added for every war won, then on destruction summed
            across every base attacked. A war still being fought counts as it stands; its win bonus
            waits for the end.
          </p>
        </Panel>

        <Panel title="Our rounds" tight>
          <RoundList rounds={league.rounds} />
        </Panel>
      </div>

      <Panel title="Season roster" action={<Chip>{league.members.length} played</Chip>} tight>
        {league.members.length ? (
          <MemberTable rows={league.members} />
        ) : (
          <p className="p-4 text-[13px] text-faint">Nobody has attacked yet — battle day has not started.</p>
        )}
        <p className="border-t border-line px-4 py-2.5 text-[11px] text-faint">
          Stars are the stars a member <em>added</em>: a hit on a base someone had already beaten
          counts only what it improved. That is also what league medals are paid on. Missed attacks
          are from finished wars and cannot be recovered; attacks still to use are not missed yet.
        </p>
      </Panel>
    </>
  );
}

function OwingTable({ rows }: { rows: WarMemberRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={`${HEAD} w-12 text-right`}>#</th>
            <th className={`${HEAD} text-left`}>Player</th>
            <th className={`${HEAD} w-16 text-right`}>TH</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StandingsTable({ rows, clanTag, ranked }: { rows: LeagueStanding[]; clanTag: string; ranked: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={`${HEAD} w-10 text-right`}>#</th>
            <th className={`${HEAD} text-left`}>Clan</th>
            <th className={`${HEAD} text-right`}>W–L</th>
            <th className={`${HEAD} text-right`}>Stars</th>
            <th className={`${HEAD} text-right`}>Destruction</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const mine = s.tag === clanTag;
            return (
              <tr key={s.tag}
                aria-current={mine ? 'true' : undefined}
                className={`border-b border-line/40 last:border-0 ${mine ? 'bg-gold/10' : 'hover:bg-panel-2'}`}>
                <td className={`num ${CELL} text-right text-faint`}>{ranked ? s.rank : '—'}</td>
                <td className={CELL}>
                  {mine
                    ? <span className="font-semibold">{s.name}</span>
                    : <a href={`/clan/${s.tag.slice(1)}/league`} className="hover:text-info hover:underline">{s.name}</a>}
                </td>
                <td className={`num ${CELL} text-right text-muted`}>{record(s)}</td>
                <td className={`num ${CELL} text-right`}>
                  <span className="text-gold">{s.stars}★</span>
                  {s.bonus > 0 && <span className="text-faint" title="Win bonus included"> +{s.bonus}</span>}
                </td>
                <td className={`num ${CELL} text-right text-muted`}>{Math.round(s.destruction).toLocaleString('en-US')}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RoundList({ rounds }: { rounds: LeagueRound[] }) {
  return (
    <ol className="grid">
      {rounds.map((r) => {
        const fought = r.status === 'inWar' || r.status === 'warEnded';
        return (
          <li key={r.round} className="flex items-center gap-3 border-b border-line/40 px-4 py-2.5 last:border-0">
            <div className="num w-6 text-[11px] font-semibold text-faint">R{r.round}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px]">
                {r.opponent
                  ? <a href={`/clan/${r.opponent.tag.slice(1)}`} className="hover:text-info hover:underline">{r.opponent.name}</a>
                  : <span className="text-faint">{ROUND_LABEL[r.status]}</span>}
              </div>
              {r.opponent && (
                <div className="text-[11px] text-faint">
                  {ROUND_LABEL[r.status]}
                  {r.status === 'preparation' && ` · battle ${fmtRelative(r.startTime)}`}
                  {r.status === 'inWar' && ` · ends ${fmtRelative(r.endTime)}`}
                </div>
              )}
            </div>
            {fought && (
              <div className="num text-right text-[13px]">
                <span className={r.standing === 'ahead' ? 'text-ok' : r.standing === 'behind' ? 'text-bad' : ''}>{r.stars}</span>
                <span className="text-faint"> – {r.opponentStars}</span>
              </div>
            )}
            {r.result && (
              <span className={`inline-flex w-10 justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${RESULT_TONE[r.result]}`}>
                {r.result}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function MemberTable({ rows }: { rows: LeagueMemberSeason[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={`${HEAD} text-left`}>Player</th>
            <th className={`${HEAD} text-right`}>TH</th>
            <th className={`${HEAD} text-right`}>Wars</th>
            <th className={`${HEAD} text-right`}>Attacks</th>
            <th className={`${HEAD} text-right`} title="Stars this member added — a hit on a base that was already beaten counts only what it improved">Stars</th>
            <th className={`${HEAD} text-right`}>Avg %</th>
            <th className={`${HEAD} text-right`} title="Best stars taken off their base, summed over the wars it was attacked in">Conceded</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.tag} className="border-b border-line/40 last:border-0 hover:bg-panel-2">
              <td className={CELL}>
                <a href={`/player/${m.tag.slice(1)}`} className="hover:text-info hover:underline">{m.name}</a>
              </td>
              <td className={`num ${CELL} text-right`}>{m.townHallLevel}</td>
              <td className={`num ${CELL} text-right text-muted`}>{m.wars}</td>
              <td className={`num ${CELL} text-right`}>
                <span className={m.missed ? 'text-bad' : 'text-muted'}>{m.attacksUsed}/{m.wars}</span>
                {m.missed > 0 && <span className="text-bad"> · {m.missed} missed</span>}
                {m.owed > 0 && <span className="text-warn"> · {m.owed} to go</span>}
              </td>
              <td className={`num ${CELL} text-right`}>
                <span className={m.stars ? 'text-gold' : 'text-faint'}>{m.stars}★</span>
              </td>
              <td className={`num ${CELL} text-right text-muted`}>
                {m.attacksUsed ? `${m.avgDestruction.toFixed(0)}%` : '—'}
              </td>
              <td className={`num ${CELL} text-right text-muted`}>
                {m.defended ? `${m.starsConceded}★ in ${m.defended}` : <span className="text-ok">clean</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
