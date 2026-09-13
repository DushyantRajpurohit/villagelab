import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClan } from '@/lib/data/clans';
import { getCurrentWar } from '@/lib/data/wars';
import { normalizeTag } from '@/lib/coc/tags';
import { Banner, Empty, Panel } from '@/components/primitives';
import { ClanShell } from '@/components/ClanShell';
import { WarBoard } from '@/components/war/WarBoard';

/**
 * A live war moves faster than anything else on the site, so this page is
 * revalidated more aggressively than the roster. It still never reaches
 * Supercell — it re-reads whatever the ingestion worker last stored.
 */
export const revalidate = 120;

type Params = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tag } = await params;
  const [clan, war] = await Promise.all([getClan(tag), getCurrentWar(tag)]);
  if (clan.status !== 'ok') return { title: 'Clan not found', robots: { index: false, follow: false } };
  return {
    title: `${clan.clan.name} — current war`,
    // A clan out of war is a thin page that rewrites itself hourly. Worth
    // serving, not worth indexing.
    robots: war.status === 'ok' ? undefined : { index: false, follow: true },
    description: `Live war progress for ${clan.clan.name} (${clan.clan.tag}): stars, destruction, the matchup and every attack still owed.`,
    alternates: { canonical: `/clan/${clan.clan.tag.slice(1)}/war` },
  };
}

export default async function CurrentWarPage({ params }: Params) {
  const { tag } = await params;
  const r = await getCurrentWar(tag);
  if (r.status === 'invalid') notFound();
  const norm = normalizeTag(tag);

  return (
    <ClanShell tag={norm} active="war">
      {r.status === 'ok' && r.mock && (
        <Banner tone="warn">
          <span><b className="text-text">Mock data.</b> Generated from the tag so the war room works offline.</span>
        </Banner>
      )}

      {r.status === 'ok' ? <WarBoard war={r.war} /> : (
        <Panel>
          <Empty title={r.status === 'queued' ? 'Looking this clan up' : 'Not in a war right now'}>
            <p className="mx-auto max-w-[52ch]">
              {r.status === 'queued'
                ? <>We haven&rsquo;t seen <code className="num">{norm}</code> before, so it has been queued for the next ingestion run. Reload shortly.</>
                : <>When a war starts, the matchup, the scoreline and every unused attack appear here. A clan that keeps its war log private never shows a war at all. League wars are reported separately by the game, so during a Clan War League they are on the{' '}
                  <Link href={`/clan/${norm.slice(1)}/league`} className="text-info hover:underline">war league</Link> tab instead.</>}
            </p>
          </Empty>
        </Panel>
      )}
    </ClanShell>
  );
}
