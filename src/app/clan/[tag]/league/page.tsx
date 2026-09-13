import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getClan } from '@/lib/data/clans';
import { getLeague } from '@/lib/data/leagues';
import { normalizeTag } from '@/lib/coc/tags';
import { Banner, Empty, Panel } from '@/components/primitives';
import { ClanShell } from '@/components/ClanShell';
import { LeagueBoard } from '@/components/war/LeagueBoard';

/**
 * Clan War League: the group table, this clan's seven rounds, and who has
 * attacked. A league runs for about a week and a half each month and a battle
 * day moves every few minutes, so this sits between the war room's cadence and
 * the history's. It still only reads what the ingestion worker stored.
 */
export const revalidate = 300;

type Params = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tag } = await params;
  const clan = await getClan(tag);
  if (clan.status !== 'ok') return { title: 'Clan not found', robots: { index: false, follow: false } };
  return {
    title: `${clan.clan.name} — war league`,
    // Empty for most of every month, like the current war. Serve it, and keep
    // it out of the index and the sitemap.
    robots: { index: false, follow: true },
    description: `Clan War League for ${clan.clan.name} (${clan.clan.tag}): group standings, each round's result and every member's attacks.`,
    alternates: { canonical: `/clan/${clan.clan.tag.slice(1)}/league` },
  };
}

export default async function LeaguePage({ params }: Params) {
  const { tag } = await params;
  const r = await getLeague(tag);
  if (r.status === 'invalid') notFound();
  const norm = normalizeTag(tag);

  return (
    <ClanShell tag={norm} active="league">
      {r.status === 'ok' && r.mock && (
        <Banner tone="warn">
          <span><b className="text-text">Mock data.</b> A whole league group generated from the tag, so the league view works offline.</span>
        </Banner>
      )}

      {r.status === 'ok' ? <LeagueBoard league={r.league} /> : (
        <Panel>
          <Empty title={r.status === 'queued' ? 'Looking this clan up' : 'Not in a war league'}>
            <p className="mx-auto max-w-[52ch]">
              {r.status === 'queued'
                ? <>We haven&rsquo;t checked <code className="num">{norm}</code> for a league yet, so it has been queued for the next ingestion run. Reload shortly.</>
                : <>Clan War Leagues run once a month. When this clan is in one, the group table, each round and every member&rsquo;s attacks appear here.</>}
            </p>
          </Empty>
        </Panel>
      )}
    </ClanShell>
  );
}
