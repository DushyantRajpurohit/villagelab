import Image from 'next/image';
import type { ReactNode } from 'react';
import type { RawPlayer } from '@/lib/coc/client';
import type { VillageId } from '@/lib/store';
import { fmtInt } from '@/lib/format';
import { Banner, Chip, Empty, PageHead, Panel, Stat } from '@/components/primitives';
import { TagSearch } from '@/components/TagSearch';
import { VillageTabs } from '@/components/VillageTabs';
import { buildingSpriteUrl } from '@/lib/sprites';

/**
 * The parts of a player page that are the same whichever village you are on.
 *
 * Identity, the tag search and the village switch belong to the account, not to
 * a village, so they live here and each village page supplies only its own
 * numbers below them.
 */

export function PlayerFrame({ tag, children }: { tag: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1400px] p-5">
      <PageHead
        title="Player dashboard"
        sub="How close an account is to the ceiling for its hall, what closing the gap costs, and whether it is rushed."
        action={<TagSearch initial={tag} basePath="/player" />}
      />
      <div className="grid gap-4">{children}</div>
    </main>
  );
}

export function PlayerNotFound({ tag }: { tag: string }) {
  return (
    <Banner tone="warn">
      No player exists with tag <code className="num mx-1">{tag}</code>. Tags are on
      the in-game profile screen, under your name.
    </Banner>
  );
}

export function PlayerQueued({ tag }: { tag: string }) {
  return (
    <Panel>
      <Empty title="Looking this player up">
        <p className="mx-auto max-w-[52ch]">
          We haven&rsquo;t seen <code className="num">{tag}</code> before, so it has
          been queued for the next ingestion run. Reload in a minute or two.
        </p>
      </Empty>
    </Panel>
  );
}

export function MockBanner() {
  return (
    <Banner tone="warn">
      <span>
        <b className="text-text">Mock data.</b> Generated deterministically from the tag so the app
        works with no credentials. Set <code>DATABASE_URL</code> and run the ingestion worker for
        real profiles.
      </span>
    </Banner>
  );
}

const prettyRole = (r: string) =>
  ({ member: 'Member', admin: 'Elder', coLeader: 'Co-leader', leader: 'Leader' })[r] ?? r;

/**
 * Who the account is, plus the village switch.
 *
 * The trophy figures shown are the ones belonging to `active`: the two villages
 * keep separate trophies and separate leagues, and showing home trophies on the
 * Builder Base page would be quietly wrong.
 */
export function PlayerIdentity({ p, active }: { p: RawPlayer; active: VillageId }) {
  const bh = p.builderHallLevel ?? 0;
  const hallChip = active === 'home' ? `TH${p.townHallLevel}` : bh ? `BH${bh}` : 'No Builder Base';
  const path = `/player/${p.tag.slice(1)}`;

  // The hall this account actually has, drawn at its own level. It is the one
  // picture that says more than any figure beside it — a TH6 and a TH16 are
  // recognisably different buildings — so it leads the banner.
  const hall = active === 'home'
    ? buildingSpriteUrl('__townhall', p.townHallLevel)
    : bh ? buildingSpriteUrl('__builderhall', bh, 'builder') : null;

  return (
    <section className="banner-hero p-5">
      <div className="flex flex-wrap items-center gap-5">
        {hall && (
          <div className="relative grid h-[92px] w-[92px] shrink-0 place-items-center rounded-full border border-line bg-panel-2/70">
            <span
              aria-hidden
              className="absolute inset-1 rounded-full"
              style={{ background: 'radial-gradient(closest-side, var(--wash-warm), transparent)' }}
            />
            <Image
              src={hall}
              alt={`${hallChip} hall`}
              width={78}
              height={78}
              className="relative object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,.45)]"
            />
          </div>
        )}

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="shelf-title text-[26px]">{p.name}</h2>
            <Chip tone="gold">{hallChip}</Chip>
            {p.role && <Chip>{prettyRole(p.role)}</Chip>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-muted">
            <code className="num">{p.tag}</code>
            <span>· {p.clan ? p.clan.name || 'in a clan' : 'no clan'}</span>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-7">
          {/* The account's level, not a village's — so it heads both. */}
          <Stat label="XP level" value={fmtInt(p.expLevel)} />
          {active === 'home' ? (
            <>
              <Stat label="Trophies" value={fmtInt(p.trophies)} sub={p.league?.name ?? 'Unranked'} />
              <Stat label="Best" value={fmtInt(p.bestTrophies)} />
              <Stat label="Donated" value={fmtInt(p.donations)}
                sub={`${fmtInt(p.donationsReceived)} received`} />
            </>
          ) : (
            <>
              <Stat label="Builder trophies" value={p.builderBaseTrophies != null ? fmtInt(p.builderBaseTrophies) : '—'} />
              <Stat label="Best" value={p.bestBuilderBaseTrophies != null ? fmtInt(p.bestBuilderBaseTrophies) : '—'} />
            </>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-3.5">
        <VillageTabs
          active={active}
          tabs={[
            { id: 'home', href: path, sub: `TH${p.townHallLevel}` },
            {
              id: 'builder',
              href: `${path}/builder`,
              sub: bh ? `BH${bh}` : 'not unlocked',
              disabled: !bh,
            },
          ]}
        />
      </div>
    </section>
  );
}
