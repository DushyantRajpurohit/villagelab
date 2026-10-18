import Image from 'next/image';
import type { ReactNode } from 'react';
import type { RawPlayer } from '@/lib/coc/client';
import type { VillageId } from '@/lib/store';
import { fmtInt } from '@/lib/format';
import { Banner, Chip, Empty, PageHead, Panel, Score } from '@/components/primitives';
import { analyseBuilderUnits, analyseUnits } from '@/lib/game/progress';
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
      <div className="grid gap-4 [&>*]:min-w-0">{children}</div>
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
  const rows: Array<{ level: number; maxHere: number }> = active === 'home'
    ? analyseUnits(p) : bh ? analyseBuilderUnits(p) : [];
  const reached = rows.reduce((n, r) => n + r.level, 0);
  const allowed = rows.reduce((n, r) => n + r.maxHere, 0);

  // The hall this account actually has, drawn at its own level. It is the one
  // picture that says more than any figure beside it — a TH6 and a TH16 are
  // recognisably different buildings — so it leads the banner.
  const hall = active === 'home'
    ? buildingSpriteUrl('__townhall', p.townHallLevel)
    : bh ? buildingSpriteUrl('__builderhall', bh, 'builder') : null;

  return (
    <section className="banner-hero px-5 pt-5 pb-4">
      <div className="flex flex-wrap items-center gap-5">
        {hall && (
          <div className="grid h-[112px] w-[112px] shrink-0 place-items-center">
            <Image
              src={hall}
              alt={`${hallChip} hall`}
              width={112}
              height={112}
              className="object-contain"
            />
          </div>
        )}

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="shelf-title text-[40px] sm:text-[52px]">{p.name}</h2>
            <Chip tone="gold">{hallChip}</Chip>
            {p.role && <Chip>{prettyRole(p.role)}</Chip>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[15px] text-text-2">
            <code className="num">{p.tag}</code>
            <span>· {p.clan ? p.clan.name || 'in a clan' : 'no clan'}</span>
          </div>
        </div>
        <div className="flex-1" />
        {/* The village's result, set like the cover's: levels reached against
            levels the hall allows. */}
        {rows.length > 0 && (
          <div>
            <Score a={fmtInt(reached)} b={fmtInt(allowed)} className="text-[clamp(3.25rem,7vw,5.5rem)]" />
            <p className="mt-1.5 text-[13px] text-text-2">levels reached v allowed at {hallChip}</p>
          </div>
        )}
      </div>

      {/* The rest of the account in one almanac line rather than a row of
          boxes. XP is the account's, not a village's, so it heads both. */}
      <p className="num mt-4 text-[15px] text-text-2">
        XP level <b className="text-text">{fmtInt(p.expLevel)}</b>
        {active === 'home' ? (
          <>
            {' · '}<b className="text-text">{fmtInt(p.trophies)}</b> trophies, {p.league?.name ?? 'unranked'}
            {' · '}best <b className="text-text">{fmtInt(p.bestTrophies)}</b>
            {' · '}donated <b className="text-text">{fmtInt(p.donations)}</b>, received {fmtInt(p.donationsReceived)}
          </>
        ) : (
          <>
            {' · '}<b className="text-text">{p.builderBaseTrophies != null ? fmtInt(p.builderBaseTrophies) : '—'}</b> builder trophies
            {' · '}best <b className="text-text">{p.bestBuilderBaseTrophies != null ? fmtInt(p.bestBuilderBaseTrophies) : '—'}</b>
          </>
        )}
      </p>

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
