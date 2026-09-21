import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { TagSearch } from '@/components/TagSearch';
import { SectionHead } from '@/components/primitives';
import { buildingSpriteUrl, unitSpriteUrl } from '@/lib/sprites';

/**
 * The storefront.
 *
 * Laid out the way a game store front page is: one banner that says what the
 * place is and takes the one input that matters, then shelves of tiles, each
 * tile a single thing you can go and do with its art standing on a lit stage.
 * Nothing here is for sale, so the corner flag that a store hangs a discount
 * from names the tool instead — it is the same glance, answering "what is
 * this" rather than "what does it cost".
 *
 * The art is the game's own, pulled from the sprite index the rest of the site
 * uses, so a tile advertises a tool with the object that tool is about: the
 * Laboratory for the planner, the Clan Castle for the war room.
 */

const TOOLS = [
  {
    href: '/player',
    flag: 'Live',
    title: 'Player dashboard',
    copy: 'Army progress against the Town Hall ceiling, rushed units named, and the cost to close the gap.',
    art: unitSpriteUrl('barbarian_king'),
    alt: 'Barbarian King',
    hue: 'var(--color-gold)',
  },
  {
    href: '/planner',
    flag: 'Plan',
    title: 'Upgrade planner',
    copy: 'Queue upgrades and get a real completion date across builders, laboratory and hero altars.',
    art: buildingSpriteUrl('laboratory', 15),
    alt: 'Laboratory',
    hue: 'var(--color-elixir)',
  },
  {
    href: '/clan',
    flag: 'War',
    title: 'Clan war room',
    copy: 'Roster health, donation ratios and war form tracked over time — history the game’s API does not keep.',
    art: buildingSpriteUrl('clan_castle', 13),
    alt: 'Clan Castle',
    hue: 'var(--color-info)',
  },
];

export default function Home() {
  const townHall = buildingSpriteUrl('__townhall', 18);

  return (
    <main className="mx-auto w-full max-w-[1200px] px-5 py-6 sm:py-8">
      {/* --- the banner ---------------------------------------------------- */}
      <section className="banner-hero px-6 py-8 sm:px-10 sm:py-12">
        <div className="flex flex-wrap items-center gap-8">
          <div className="min-w-[280px] flex-1">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/12 px-3 py-1 text-[11px] font-bold tracking-[.1em] text-gold uppercase">
              Unofficial companion
            </span>

            <h1 className="shelf-title mt-4 text-[38px] sm:text-[52px]">
              Know exactly where your
              <br className="hidden sm:block" /> village <span className="text-gold">stands</span>.
            </h1>

            <p className="mt-4 max-w-[52ch] text-[15px] text-text-2">
              Progress tracking, upgrade planning and war analytics for Clash of Clans. Look up any
              player to see how close their army is to the ceiling for its Town Hall — and what
              closing the gap costs.
            </p>

            <div className="mt-6">
              <TagSearch basePath="/player" size="lg" />
            </div>

            <p className="mt-3 text-[12px] text-faint">
              No account, nothing to install. Try a sample profile:{' '}
              <Link className="font-bold text-gold hover:underline" href="/player/2PP0JCVL9">
                #2PP0JCVL9
              </Link>
            </p>
          </div>

          {/* The hall itself, lit from above and standing on its own shadow.
              Decorative — the banner says everything this says — so it is the
              first thing to go when there is no room for it. */}
          {townHall && (
            <div className="relative hidden w-[240px] shrink-0 place-items-center lg:grid">
              <div
                aria-hidden
                className="absolute inset-0 rounded-full blur-2xl"
                style={{ background: 'radial-gradient(closest-side, var(--wash-warm), transparent)' }}
              />
              <Image
                src={townHall}
                alt=""
                aria-hidden
                width={240}
                height={240}
                priority
                className="relative drop-shadow-[0_18px_22px_rgba(0,0,0,.45)]"
              />
            </div>
          )}
        </div>
      </section>

      {/* --- the shelf ----------------------------------------------------- */}
      <div className="mt-10">
        <SectionHead
          title="Four tools, one village"
          sub="Each one reads from the same account — pick where you want to start."
        />
        <div className="shelf">
          {TOOLS.map((t) => (
            <article key={t.href} className="tile">
              <span className="flag">{t.flag}</span>

              <div
                className="stage h-[152px] w-full"
                style={{ '--stage-hue': t.hue } as CSSProperties}
              >
                {t.art && (
                  <Image src={t.art} alt={t.alt} width={112} height={112} className="object-contain" />
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2 p-4">
                <h3 className="display text-[16px]">{t.title}</h3>
                <p className="text-[13px] text-muted">{t.copy}</p>
                <div className="flex-1" />
                {/* One action per tile, and the whole tile is that action:
                    the link stretches over the card so the target is the card,
                    while the button is what tells you so. */}
                <Link href={t.href} className="btn btn-gold raised mt-2 after:absolute after:inset-0">
                  Open
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* --- what you get -------------------------------------------------- */}
      <div className="mt-12">
        <SectionHead
          title="What the lab actually tells you"
          sub="Figures the game shows you one screen at a time, added up."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Feature title="Priced in real currency">
            Every remaining upgrade is totalled in gold, elixir and dark elixir — with the game&rsquo;s
            own badge beside each figure, because a number without its currency is not an answer.
          </Feature>
          <Feature title="Rushed, and by how much">
            A unit below the previous hall&rsquo;s ceiling is named as rushed and sorted by what it
            costs to fix, so the list is a work order rather than a verdict.
          </Feature>
          <Feature title="History the API forgets">
            War results and roster movement are kept as they are ingested, which is the one thing
            the official API will not hand you after the fact.
          </Feature>
        </div>
      </div>

      <p className="mt-10 text-center text-[12px] text-faint">
        Sprites and game data are used under Supercell&rsquo;s Fan Content Policy. VillageLab is not
        affiliated with Supercell.
      </p>
    </main>
  );
}

function Feature({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="surface p-4">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="h-4 w-1 rounded-full bg-gold" />
        <h3 className="display text-[15px]">{title}</h3>
      </div>
      <p className="mt-2 text-[13px] text-muted">{children}</p>
    </div>
  );
}
