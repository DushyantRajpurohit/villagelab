import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPlayer } from '@/lib/data/players';
import { analyseBuilderUnits, summariseBuilder } from '@/lib/game/progress';
import { normalizeTag } from '@/lib/coc/tags';
import { fmtInt } from '@/lib/format';
import { Banner } from '@/components/primitives';
import {
  MockBanner, PlayerFrame, PlayerIdentity, PlayerNotFound, PlayerQueued,
} from '@/components/player/PlayerFrame';
import { BuilderVillage } from '@/components/player/BuilderVillage';
import { BuilderVillageBuildings } from '@/components/player/VillageBuildings';

/**
 * The second village, on its own URL.
 *
 * It gets a page rather than a section of the Home Village page because it is a
 * separate village: its own hall, its own currencies, its own troops and its
 * own trophies. A URL each also means either village can be linked and indexed
 * on its own, the way /clan/[tag]/war already is.
 */

export const revalidate = 300;

type Params = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tag } = await params;
  const result = await getPlayer(tag);
  if (result.status !== 'ok') {
    return { title: 'Player not found', robots: { index: false, follow: false } };
  }
  const p = result.player;
  const bh = p.builderHallLevel;
  if (!bh) {
    return { title: `${p.name} (${p.tag}) — no Builder Base`, robots: { index: false, follow: true } };
  }
  return {
    title: `${p.name} (${p.tag}) — BH${bh}`,
    description: `${p.name}'s Builder Base: Builder Hall ${bh}, ${fmtInt(p.builderBaseTrophies ?? 0)} builder trophies, troop and hero progress against the BH${bh} ceiling and what maxing it costs.`,
    alternates: { canonical: `/player/${p.tag.slice(1)}/builder` },
  };
}

export default async function BuilderBasePage({ params }: Params) {
  const { tag } = await params;
  const result = await getPlayer(tag);

  if (result.status === 'invalid') notFound();
  if (result.status === 'not_found') {
    return <PlayerFrame tag={normalizeTag(tag)}><PlayerNotFound tag={normalizeTag(tag)} /></PlayerFrame>;
  }
  if (result.status === 'queued') {
    return <PlayerFrame tag={normalizeTag(tag)}><PlayerQueued tag={normalizeTag(tag)} /></PlayerFrame>;
  }

  const p = result.player;
  const bh = p.builderHallLevel ?? 0;

  return (
    <PlayerFrame tag={p.tag}>
      {result.mock && <MockBanner />}
      <PlayerIdentity p={p} active="builder" />

      {bh ? (
        <>
          <BuilderVillage bh={bh} summary={summariseBuilder(analyseBuilderUnits(p))} />
          {/* The hall's own allowance. Units come from the account; buildings
              cannot — the API has no building levels — so this is framed as
              what the hall permits rather than what the player has. */}
          <BuilderVillageBuildings bh={bh} />
        </>
      ) : (
        <Banner>
          <span>
            <b className="text-text">{p.name} has no Builder Base.</b> It opens at Town Hall 6, by
            repairing the boat on the seashore — this account is at Town Hall {p.townHallLevel}.
          </span>
        </Banner>
      )}
    </PlayerFrame>
  );
}
