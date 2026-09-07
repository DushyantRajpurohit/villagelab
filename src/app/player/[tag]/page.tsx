import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPlayer } from '@/lib/data/players';
import { analyseUnits, summarise } from '@/lib/game/progress';
import { normalizeTag } from '@/lib/coc/tags';
import { fmtDuration, fmtInt } from '@/lib/format';
import { Bar, Chip, Panel, Res, Stat, pctTone } from '@/components/primitives';
import { RESOURCE_NAME } from '@/components/GameIcon';
import { UnitTable } from '@/components/UnitTable';
import { HeroRoster } from '@/components/HeroRoster';
import { HomeVillageBuildings } from '@/components/player/VillageBuildings';
import {
  MockBanner, PlayerFrame, PlayerIdentity, PlayerNotFound, PlayerQueued,
} from '@/components/player/PlayerFrame';

/**
 * Public, server-rendered player page — the Home Village.
 *
 * The second village lives at `/builder` rather than further down this page.
 * They are separate villages with separate halls, separate currencies and
 * separate progress, and interleaving them made one long page where the
 * Builder Base sat between two Home Village sections.
 *
 * Reads only from our own store — see src/lib/data/players.ts for why a cache
 * miss enqueues rather than fetching upstream.
 */

// Cached at the edge; the ingestion worker is what keeps the data fresh.
export const revalidate = 300;

type Params = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tag } = await params;
  const result = await getPlayer(tag);
  if (result.status !== 'ok') {
    return { title: 'Player not found', robots: { index: false, follow: false } };
  }
  const p = result.player;
  return {
    title: `${p.name} (${p.tag}) — TH${p.townHallLevel}`,
    description: `${p.name} is a Town Hall ${p.townHallLevel} player with ${fmtInt(p.trophies)} trophies and ${fmtInt(p.warStars)} war stars. See army progress, rushed units and the cost to max.`,
    alternates: { canonical: `/player/${p.tag.slice(1)}` },
  };
}

const KIND_LABEL: Record<string, string> = {
  hero: 'Heroes', pet: 'Pets', troop: 'Troops', spell: 'Spells', siege: 'Siege machines',
};
const KIND_ORDER = ['hero', 'pet', 'troop', 'spell', 'siege'] as const;

export default async function PlayerPage({ params }: Params) {
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
  const rows = analyseUnits(p);
  const s = summarise(rows);
  const th = p.townHallLevel;
  const rushed = rows.filter((r) => r.rushed);

  return (
    <PlayerFrame tag={p.tag}>
      {result.mock && <MockBanner />}
      <PlayerIdentity p={p} active="home" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <Stat label="Army progress" value={`${s.overallPct.toFixed(0)}%`}
            sub={`${s.maxedCount} of ${rows.length} maxed for TH${th}`} />
          <div className="mt-2.5"><Bar pct={s.overallPct} tone={pctTone(s.overallPct)} /></div>
        </Panel>
        <Panel>
          <Stat label="Rushed units" value={String(s.rushedCount)} tone={s.rushedCount ? 'bad' : 'ok'}
            sub={s.rushedCount ? `below the TH${th - 1} ceiling` : 'nothing left behind'} />
        </Panel>
        <Panel>
          <Stat label="Lab time left" value={fmtDuration(s.totalHours)} sub="one laboratory, sequential" />
        </Panel>
        <Panel>
          <Stat label="War stars" value={fmtInt(p.warStars)} sub={`${fmtInt(p.attackWins)} attack wins`} />
        </Panel>
      </div>

      <Panel
        title={`Cost to max the army at TH${th}`}
        action={s.est ? <Chip title="Some values are interpolated, not verified">≈ includes estimates</Chip> : null}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {(['elixir', 'dark', 'gold'] as const)
            .filter((k) => s.cost[k] > 0)
            .map((k) => (
              <div key={k}>
                <div className="text-[11px] uppercase tracking-[.06em] text-muted">
                  {RESOURCE_NAME[k]}
                </div>
                <div className="text-[22px] font-semibold"><Res amount={s.cost[k]} kind={k} est={s.est} /></div>
              </div>
            ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          Laboratory, hero and pet upgrades only. The API does not expose building levels — record those
          in the planner for a full picture.
        </p>
      </Panel>

      {rushed.length > 0 && (
        <Panel title="Rushed — behind the previous Town Hall"
          action={<Chip tone="bad">{rushed.length} unit{rushed.length === 1 ? '' : 's'}</Chip>} tight>
          <UnitTable rows={sortBy(rushed, (r) => -r.remainingCost)} th={th} />
        </Panel>
      )}

      {KIND_ORDER.filter((k) => rows.some((r) => r.kind === k)).map((kind) => {
        const group = rows.filter((r) => r.kind === kind);
        const done = group.filter((r) => r.level >= r.maxHere).length;
        return (
          <Panel key={kind} title={KIND_LABEL[kind]} tight
            action={<Chip tone={done === group.length ? 'ok' : 'plain'}>{done}/{group.length} maxed</Chip>}>
            {/* Heroes get the hall treatment; everything else is a table,
                because forty troops are a list and five heroes are a cast. */}
            {kind === 'hero'
              ? <HeroRoster heroes={group} hall={th} />
              : <UnitTable rows={sortBy(group, (r) => r.pct)} th={th} />}
          </Panel>
        );
      })}

      {/* What the hall permits, not what the account has — the API carries no
          building levels for either village. */}
      <HomeVillageBuildings th={th} />
    </PlayerFrame>
  );
}

function sortBy<T>(rows: T[], key: (r: T) => number): T[] {
  return [...rows].sort((a, b) => key(a) - key(b));
}
