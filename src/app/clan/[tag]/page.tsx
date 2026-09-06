import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { donationRatio, getClan } from '@/lib/data/clans';
import { normalizeTag } from '@/lib/coc/tags';
import { fmtInt } from '@/lib/format';
import { Banner, Chip, Empty, Panel, Stat } from '@/components/primitives';
import { ClanRoster, ThSpread } from '@/components/ClanRoster';
import { ClanShell } from '@/components/ClanShell';

export const revalidate = 300;

type Params = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tag } = await params;
  const r = await getClan(tag);
  if (r.status !== 'ok') return { title: 'Clan not found', robots: { index: false, follow: false } };
  const c = r.clan;
  return {
    title: `${c.name} (${c.tag}) — level ${c.clanLevel} clan`,
    description: `${c.name} is a level ${c.clanLevel} clan with ${c.members} members, ${fmtInt(c.clanPoints)} points and a ${c.warWins}-${c.warLosses} war record. See roster health and donation ratios.`,
    alternates: { canonical: `/clan/${c.tag.slice(1)}` },
  };
}

export default async function ClanPage({ params }: Params) {
  const { tag } = await params;
  const r = await getClan(tag);

  if (r.status === 'invalid') notFound();

  if (r.status !== 'ok') {
    return (
      <ClanShell tag={normalizeTag(tag)} active="roster">
        <Panel>
          <Empty title={r.status === 'not_found' ? 'No such clan' : 'Looking this clan up'}>
            <p className="mx-auto max-w-[52ch]">
              {r.status === 'not_found'
                ? <>Nothing exists with tag <code className="num">{normalizeTag(tag)}</code>.</>
                : <>We haven&rsquo;t seen <code className="num">{normalizeTag(tag)}</code> before, so it has been queued for the next ingestion run. Reload shortly.</>}
            </p>
          </Empty>
        </Panel>
      </ClanShell>
    );
  }

  const c = r.clan;
  const members = c.memberList;
  const totalWars = c.warWins + c.warLosses + c.warTies;
  const winRate = totalWars ? (c.warWins / totalWars) * 100 : 0;
  const totalDon = members.reduce((a, m) => a + m.donations, 0);
  const freeloaders = members.filter((m) => donationRatio(m) < 0.35).length;

  return (
    <ClanShell tag={c.tag} active="roster">
      {r.mock && (
        <Banner tone="warn">
          <span><b className="text-text">Mock data.</b> Generated from the tag so the app works offline.</span>
        </Banner>
      )}

      <Panel>
        <div className="flex flex-wrap items-center gap-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="display text-[22px]">{c.name}</h1>
              <Chip tone="gold">Lv {c.clanLevel}</Chip>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-muted">
              <code className="num">{c.tag}</code>
              <span>· {c.members}/50 members</span>
              <span>· requires TH{c.requiredTownhallLevel} / {fmtInt(c.requiredTrophies)} cups</span>
            </div>
            {c.description && <p className="mt-2 max-w-[70ch] text-[13px] text-muted">{c.description}</p>}
          </div>
          <div className="flex-1" />
          <div className="flex flex-wrap gap-7">
            <Stat label="Clan points" value={fmtInt(c.clanPoints)} />
            <Stat label="War record" value={`${c.warWins}–${c.warLosses}${c.warTies ? `–${c.warTies}` : ''}`}
              sub={`${winRate.toFixed(0)}% win rate`} />
            <Stat label="Win streak" value={String(c.warWinStreak)} />
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel><Stat label="Members" value={`${members.length}/50`} /></Panel>
        <Panel><Stat label="Total donations" value={fmtInt(totalDon)}
          sub={`${fmtInt(Math.round(totalDon / Math.max(1, members.length)))} average`} /></Panel>
        <Panel><Stat label="Freeloaders" value={String(freeloaders)} tone={freeloaders ? 'warn' : 'ok'}
          sub="give under a third of what they take" /></Panel>
        <Panel><Stat label="Top Town Hall"
          value={members.length ? `TH${Math.max(...members.map((m) => m.townHallLevel))}` : '—'} /></Panel>
      </div>

      <Panel title="Town Hall spread"><ThSpread members={members} /></Panel>

      <Panel title="Roster" tight><ClanRoster members={members} /></Panel>
    </ClanShell>
  );
}

