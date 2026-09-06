import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getClan } from '@/lib/data/clans';
import { getWarLog } from '@/lib/data/wars';
import { normalizeTag } from '@/lib/coc/tags';
import { Banner, Empty, Panel } from '@/components/primitives';
import { ClanShell } from '@/components/ClanShell';
import { WarLogBoard } from '@/components/war/WarLogBoard';

export const revalidate = 600;

type Params = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tag } = await params;
  const clan = await getClan(tag);
  if (clan.status !== 'ok') return { title: 'Clan not found', robots: { index: false, follow: false } };
  return {
    title: `${clan.clan.name} — war log`,
    description: `War history for ${clan.clan.name} (${clan.clan.tag}): record, win rate, average stars and destruction across recent wars.`,
    alternates: { canonical: `/clan/${clan.clan.tag.slice(1)}/log` },
  };
}

export default async function WarLogPage({ params }: Params) {
  const { tag } = await params;
  const r = await getWarLog(tag);
  if (r.status === 'invalid') notFound();
  const norm = normalizeTag(tag);

  return (
    <ClanShell tag={norm} active="log">
      {r.status === 'ok' && r.mock && (
        <Banner tone="warn">
          <span><b className="text-text">Mock data.</b> Generated from the tag so the war room works offline.</span>
        </Banner>
      )}

      {r.status === 'ok' && r.entries.length ? (
        <WarLogBoard entries={r.entries} summary={r.summary} />
      ) : (
        <Panel>
          <Empty title={r.status === 'queued' ? 'Looking this clan up' : 'No war history'}>
            <p className="mx-auto max-w-[52ch]">
              {r.status === 'queued'
                ? <>We haven&rsquo;t seen <code className="num">{norm}</code> before, so it has been queued for the next ingestion run. Reload shortly.</>
                : <>Nothing recorded for this clan yet. Clans that keep their war log private publish no history at all.</>}
            </p>
          </Empty>
        </Panel>
      )}
    </ClanShell>
  );
}
