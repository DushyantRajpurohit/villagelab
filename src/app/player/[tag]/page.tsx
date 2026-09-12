import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPlayer } from '@/lib/data/players';
import { analyseEquipment, analyseUnits, summarise, summariseEquipment } from '@/lib/game/progress';
import { normalizeTag } from '@/lib/coc/tags';
import { fmtDuration, fmtInt } from '@/lib/format';
import { Bar, Chip, OreRow, Panel, Res, Stat, pctTone } from '@/components/primitives';
import { RESOURCE_NAME } from '@/components/GameIcon';
import { totalOre } from '@/lib/game/equipment';
import { UnitTable } from '@/components/UnitTable';
import { HeroRoster, type HeroGear } from '@/components/HeroRoster';
import { HomeVillageBuildings } from '@/components/player/VillageBuildings';
import { CraftedDefenses } from '@/components/player/CraftedDefenses';
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

  const gearRows = analyseEquipment(p);
  const gearSummary = summariseEquipment(gearRows);
  const gear: Record<string, HeroGear[]> = {};
  for (const g of gearRows) {
    (gear[g.hero] ??= []).push({
      id: g.id, name: g.name, rarity: g.rarity,
      level: g.level, maxHere: g.maxHere, found: g.found,
    });
  }

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
              ? <HeroRoster heroes={group} hall={th} gear={gear} />
              : <UnitTable rows={sortBy(group, (r) => r.pct)} th={th} />}
          </Panel>
        );
      })}

      {gearRows.length > 0 && (
        <Panel
          title={`Hero equipment at TH${th}`}
          action={
            <Chip tone={gearSummary.ownedCount === gearRows.length ? 'ok' : 'plain'}>
              {gearSummary.ownedCount}/{gearRows.length} obtained
            </Chip>
          }
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Equipment progress"
              value={`${gearSummary.overallPct.toFixed(0)}%`}
              sub={`${gearSummary.maxedCount} of ${gearSummary.ownedCount} maxed for TH${th}`}
            />
            <div className="sm:col-span-2">
              <div className="text-[11px] uppercase tracking-[.06em] text-muted">Ore to max what you have</div>
              <div className="mt-1 text-[22px] font-semibold">
                {totalOre(gearSummary.ore) > 0
                  ? <OreRow cost={gearSummary.ore} />
                  : <span className="text-ok">nothing owed</span>}
              </div>
              {totalOre(gearSummary.oreIfObtained) > 0 && (
                <div className="mt-2 text-[13px]">
                  <span className="text-muted">Plus, once obtained: </span>
                  <OreRow cost={gearSummary.oreIfObtained} gap="gap-2.5" />
                </div>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            Ore is not village currency — nothing else spends it and no storage banks it — and
            equipment upgrades are instant, so none of this sits on the laboratory clock above.
            The ceiling comes from the Blacksmith, which the Town Hall in turn limits.
          </p>
        </Panel>
      )}

      {/* What the hall permits, not what the account has — the API carries no
          building levels for either village. */}
      <HomeVillageBuildings th={th} />

      {/* Temporary, so deliberately after the hall's roster and outside its
          total: the Crafting Station is a structure, the defenses it becomes
          are not, and the phase takes them away again. */}
      <CraftedDefenses th={th} />
    </PlayerFrame>
  );
}

function sortBy<T>(rows: T[], key: (r: T) => number): T[] {
  return [...rows].sort((a, b) => key(a) - key(b));
}
