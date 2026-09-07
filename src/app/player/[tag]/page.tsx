import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPlayer } from '@/lib/data/players';
import { analyseBuilderUnits, analyseUnits, summarise, summariseBuilder } from '@/lib/game/progress';
import { normalizeTag } from '@/lib/coc/tags';
import { fmtDuration, fmtInt } from '@/lib/format';
import { Banner, Bar, Chip, Empty, Panel, Res, Stat, pctTone } from '@/components/primitives';
import { RESOURCE_NAME } from '@/components/GameIcon';
import { UnitTable } from '@/components/UnitTable';
import { BuilderBase } from '@/components/BuilderBase';
import { TagSearch } from '@/components/TagSearch';

/**
 * Public, server-rendered player page.
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
    return (
      <Shell tag={normalizeTag(tag)}>
        <Banner tone="warn">
          No player exists with tag <code className="num mx-1">{normalizeTag(tag)}</code>. Tags are on
          the in-game profile screen, under your name.
        </Banner>
      </Shell>
    );
  }

  if (result.status === 'queued') {
    return (
      <Shell tag={normalizeTag(tag)}>
        <Panel>
          <Empty title="Looking this player up">
            <p className="mx-auto max-w-[52ch]">
              We haven&rsquo;t seen <code className="num">{normalizeTag(tag)}</code> before, so it has
              been queued for the next ingestion run. Reload in a minute or two.
            </p>
          </Empty>
        </Panel>
      </Shell>
    );
  }

  const p = result.player;
  const rows = analyseUnits(p);
  const s = summarise(rows);
  const builder = summariseBuilder(analyseBuilderUnits(p));
  const th = p.townHallLevel;
  const rushed = rows.filter((r) => r.rushed);

  return (
    <Shell tag={p.tag}>
      {result.mock && (
        <Banner tone="warn">
          <span>
            <b className="text-text">Mock data.</b> Generated deterministically from the tag so the app
            works with no credentials. Set <code>DATABASE_URL</code> and run the ingestion worker for
            real profiles.
          </span>
        </Banner>
      )}

      <Panel>
        <div className="flex flex-wrap items-center gap-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="display text-[22px]">{p.name}</h1>
              <Chip tone="gold">TH{th}</Chip>
              {p.role && <Chip>{prettyRole(p.role)}</Chip>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-muted">
              <code className="num">{p.tag}</code>
              <span>· {p.clan ? p.clan.name || 'in a clan' : 'no clan'}</span>
              <span>· XP {p.expLevel}</span>
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex flex-wrap items-center gap-7">
            <Stat label="Trophies" value={fmtInt(p.trophies)} sub={p.league?.name ?? 'Unranked'} />
            <Stat label="Best" value={fmtInt(p.bestTrophies)} />
            <Stat label="Donated" value={fmtInt(p.donations)} sub={`${fmtInt(p.donationsReceived)} received`} />
            <div className="min-w-[140px]">
              <Stat label="Maxed for TH" value={`${s.overallPct.toFixed(0)}%`} />
              <div className="mt-1.5"><Bar pct={s.overallPct} tone={pctTone(s.overallPct)} /></div>
            </div>
          </div>
        </div>
      </Panel>

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

      {/* Only for accounts that have actually unlocked the second village. */}
      {p.builderHallLevel ? (
        <BuilderBase
          bh={p.builderHallLevel}
          trophies={p.builderBaseTrophies}
          bestTrophies={p.bestBuilderBaseTrophies}
          summary={builder}
        />
      ) : null}

      {KIND_ORDER.filter((k) => rows.some((r) => r.kind === k)).map((kind) => {
        const group = rows.filter((r) => r.kind === kind);
        const done = group.filter((r) => r.level >= r.maxHere).length;
        return (
          <Panel key={kind} title={KIND_LABEL[kind]} tight
            action={<Chip tone={done === group.length ? 'ok' : 'plain'}>{done}/{group.length} maxed</Chip>}>
            <UnitTable rows={sortBy(group, (r) => r.pct)} th={th} />
          </Panel>
        );
      })}
    </Shell>
  );
}

function sortBy<T>(rows: T[], key: (r: T) => number): T[] {
  return [...rows].sort((a, b) => key(a) - key(b));
}

const prettyRole = (r: string) =>
  ({ member: 'Member', admin: 'Elder', coLeader: 'Co-leader', leader: 'Leader' })[r] ?? r;

function Shell({ tag, children }: { tag: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1400px] p-5">
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="display text-[22px]">Player dashboard</h1>
          <p className="mt-1 max-w-[62ch] text-[13px] text-muted">
            How close an account is to the ceiling for its Town Hall, what closing the gap costs, and
            whether it is rushed.
          </p>
        </div>
        <div className="flex-1" />
        <TagSearch initial={tag} basePath="/player" />
      </div>
      <div className="grid gap-4">{children}</div>
    </main>
  );
}
