import { Bar, Chip } from './primitives';
import { fmtInt } from '@/lib/format';
import { donationRatio, type ClanMember } from '@/lib/data/clans';

const HEAD = 'sticky top-0 bg-panel px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[.06em] text-muted';
const ROLE: Record<string, string> = {
  leader: 'Leader', coLeader: 'Co-leader', admin: 'Elder', member: 'Member',
};

export function ClanRoster({ members }: { members: ClanMember[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={`${HEAD} text-right`}>#</th>
            <th className={`${HEAD} text-left`}>Player</th>
            <th className={`${HEAD} text-right`}>TH</th>
            <th className={`${HEAD} text-right`}>Trophies</th>
            <th className={`${HEAD} text-right`}>Given</th>
            <th className={`${HEAD} text-right`}>Taken</th>
            <th className={`${HEAD} text-right`}>Ratio</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const r = donationRatio(m);
            const tone = r >= 1 ? 'text-ok' : r >= 0.35 ? 'text-warn' : 'text-bad';
            return (
              <tr key={m.tag} className="border-b border-line/40 last:border-0 hover:bg-panel-2">
                <td className="num px-3 py-2 text-right text-faint">{m.clanRank}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={`/player/${m.tag.slice(1)}`} className="hover:text-info hover:underline">{m.name}</a>
                    <Chip tone={m.role === 'leader' ? 'gold' : 'plain'}>{ROLE[m.role] ?? m.role}</Chip>
                  </div>
                </td>
                <td className="num px-3 py-2 text-right">{m.townHallLevel}</td>
                <td className="num px-3 py-2 text-right">{fmtInt(m.trophies)}</td>
                <td className="num px-3 py-2 text-right text-ok">{fmtInt(m.donations)}</td>
                <td className="num px-3 py-2 text-right text-muted">{fmtInt(m.donationsReceived)}</td>
                <td className={`num px-3 py-2 text-right ${tone}`}>
                  {r === Infinity ? '∞' : r.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Town Hall distribution — the fastest read on whether a clan can war together. */
export function ThSpread({ members }: { members: ClanMember[] }) {
  const spread = members.reduce<Record<number, number>>((a, m) => {
    a[m.townHallLevel] = (a[m.townHallLevel] ?? 0) + 1;
    return a;
  }, {});
  const rows = Object.entries(spread)
    .map(([th, n]) => [Number(th), n] as const)
    .sort((a, b) => b[0] - a[0]);
  // Relative to the biggest bucket: a spread across nine Town Hall levels would
  // otherwise be nine stubs, and the distribution's shape is the point.
  const peak = Math.max(1, ...rows.map(([, n]) => n));

  return (
    <div className="grid gap-1.5">
      {rows.map(([th, n]) => (
        <div key={th} className="flex items-center gap-2.5">
          <div className="w-[54px] text-xs text-muted">TH{th}</div>
          <div className="flex-1"><Bar pct={(n / peak) * 100} /></div>
          <div className="num w-8 text-right text-xs">{n}</div>
        </div>
      ))}
    </div>
  );
}
