import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { TagSearch } from '@/components/TagSearch';
import { Res } from '@/components/primitives';
import { mockPlayer } from '@/lib/coc/mock';
import { analyseUnits, summarise } from '@/lib/game/progress';
import { fmtInt } from '@/lib/format';
import { buildingSpriteUrl, unitSpriteUrl } from '@/lib/sprites';

/**
 * The cover.
 *
 * Laid out as a matchday programme's front page: the fixture is a village
 * against the ceiling its Town Hall sets, and the scoreline is a real one —
 * the sample account run through the same engine the player page uses, so the
 * first thing a visitor sees is the product doing its job rather than a claim
 * about it. The lookup sits directly under the score because the obvious next
 * thought is "what is mine".
 *
 * Below the fold the page turns to white stock: the results the dataset was
 * checked against, the three reports a reviewer came for, and the fixture list
 * of tools.
 */

const SAMPLE = '#2PP0JCVL9';
const SAMPLE_CLAN = '#2QJ8YVLC';
const REPO = 'https://github.com/DushyantRajpurohit/villagelab';

// Figures the old interpolation curve produced against the game's published
// tables. Each row is from the README's account of replacing it.
const RESULTS = [
  { what: 'Level 21 Cannon', unit: 'gold', before: '22,500,000', after: '3,000,000' },
  { what: 'Town Hall 17', unit: 'hours to build', before: '528', after: '240' },
  { what: 'Goblin, level 1 to max', unit: 'elixir', before: '15.0M', after: '42.8M' },
  { what: 'Lava Hound, level 1 to max', unit: 'dark elixir', before: '2.0M', after: '763K' },
  { what: 'Units with the right maximum level', unit: 'of 67', before: '21', after: '67' },
];

const REPORTS = [
  {
    title: 'No visitor can reach Supercell',
    body: 'A page that misses adds the tag to a queue and shows what is already held. A worker drains the queue on a schedule, and it is the only code that imports the API client, so a crawler walking random tags cannot spend the upstream rate limit.',
  },
  {
    title: 'The parser refuses to guess',
    body: 'Every level is transcribed from the game’s published tables. The reader finds columns by their header, cross-checks the cost column, and stops when a table does not resolve. That is how it caught a boost cost standing in for a build cost.',
  },
  {
    title: 'History the API does not keep',
    body: 'The official API serves snapshots and nothing older. Snapshots are stored here whenever a value changes, which is what makes war records and roster movement answerable after the fact.',
  },
];

const FIXTURES = [
  {
    href: '/player',
    title: 'Player dashboard',
    copy: 'Every troop, spell, hero and piece of equipment against the Town Hall ceiling, with rushed units named and the gap priced.',
    art: unitSpriteUrl('barbarian_king'),
  },
  {
    href: '/planner',
    title: 'Upgrade planner',
    copy: 'Queue upgrades and get a completion date across builders, the laboratory and the hero lane, for either village.',
    art: buildingSpriteUrl('laboratory', 15),
  },
  {
    href: '/clan',
    title: 'Clan war room',
    copy: 'Roster health and donation ratios, the live war, the war league table and the war log.',
    art: buildingSpriteUrl('clan_castle', 13),
  },
];

/** One character per span so the scoreline can arrive as a run of hard cuts. */
function Digits({ value, start }: { value: string; start: number }) {
  return (
    <span aria-hidden>
      {[...value].map((ch, i) => (
        <span key={i} className="score-digit" style={{ '--d': `${(start + i) * 0.09}s` } as CSSProperties}>
          {ch}
        </span>
      ))}
    </span>
  );
}

export default function Home() {
  const player = mockPlayer(SAMPLE);
  const rows = analyseUnits(player);
  const s = summarise(rows);
  const th = player.townHallLevel;
  const reached = fmtInt(rows.reduce((n, r) => n + r.level, 0));
  const allowed = fmtInt(rows.reduce((n, r) => n + r.maxHere, 0));
  const townHall = buildingSpriteUrl('__townhall', th);
  const samplePath = `/player/${SAMPLE.slice(1)}`;
  const clanPath = `/clan/${SAMPLE_CLAN.slice(1)}`;

  return (
    <main>
      {/* --- the cover ----------------------------------------------------- */}
      <section className="banner-hero">
        <div className="mx-auto grid w-full max-w-[1400px] gap-x-8 px-5 pt-8 pb-10 lg:grid-cols-[minmax(0,1fr)_minmax(300px,520px)] lg:pt-12">
          <div className="min-w-0">
            <h1 className="shelf-title text-[clamp(2.75rem,6.8vw,5.5rem)]">
              Every village plays its Town Hall.
            </h1>
            <p className="mt-5 max-w-[60ch] text-[17px] leading-snug text-text-2">
              VillageLab is an unofficial Clash of Clans companion. Give it a player tag and it
              scores every troop, spell and hero against the most that Town Hall allows, prices
              the gap in the game&rsquo;s own currencies, and keeps the clan&rsquo;s war tables.
            </p>

            {/* The score, read aloud once for a screen reader; the digits
                themselves are decoration over that sentence. */}
            <p className="sr-only">
              Sample village {SAMPLE}: {reached} levels reached of {allowed} allowed at Town Hall {th}.
            </p>
            <div className="shelf-title mt-8 flex flex-wrap items-end gap-x-[.18em] text-[clamp(4.5rem,15vw,9.5rem)] leading-[.82] text-gold">
              <Digits value={reached} start={0} />
              <span aria-hidden className="pb-[.12em] text-[.34em] text-text">v</span>
              <span className="text-text"><Digits value={allowed} start={reached.length + 1} /></span>
            </div>
            <p className="mt-3 max-w-[60ch] text-[15px] text-text-2">
              Levels reached against levels allowed at Town Hall {th}, for sample village{' '}
              <Link className="font-bold text-gold underline" href={samplePath}>{SAMPLE}</Link>.
              That is {s.overallPct.toFixed(0)}% of the way, with {s.maxedCount} of {rows.length}{' '}
              units maxed and {s.rushedCount} rushed. The account is generated, the arithmetic is
              the app&rsquo;s own.
            </p>

            <div className="mt-8">
              <TagSearch basePath="/player" size="lg" />
              <p className="mt-2.5 text-[14px] text-text-2">
                Your tag is on the in-game profile screen, under your name. No account needed.
              </p>
            </div>
          </div>

          {/* The hall the sample village is playing, at full height. Decorative:
              the copy beside it says everything it says. */}
          {townHall && (
            <div className="hidden items-end justify-center lg:flex">
              <Image src={townHall} alt="" aria-hidden width={520} height={520} priority
                className="h-auto w-full object-contain" />
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1400px] px-5">
        {/* --- results ------------------------------------------------------ */}
        <section className="grid gap-x-10 gap-y-6 pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div>
            <h2 className="shelf-title text-[clamp(2rem,4.4vw,3.25rem)]">
              The old numbers lost to the real ones.
            </h2>
            <p className="mt-4 max-w-[58ch] text-[16px] text-text-2">
              The game&rsquo;s API gives unit levels but no upgrade costs, so every cost here comes
              from a dataset the project carries. It used to be a few known values joined by a
              curve, and the curve was wrong in both directions. It was replaced, level by level,
              from the published tables. 931 tests hold it there.
            </p>
            <p className="mt-4 text-[16px]">
              <a className="font-bold underline hover:bg-kit hover:text-ink" href={REPO}
                rel="noopener noreferrer" target="_blank">
                Read the code on GitHub
              </a>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border-t-[3px] border-text text-[15px]">
              <thead>
                <tr className="display border-b border-text text-left text-[13px] text-muted">
                  <th className="py-2 pr-4 font-extrabold">Figure</th>
                  <th className="py-2 pr-4 text-right font-extrabold">Old curve</th>
                  <th className="py-2 text-right font-extrabold">Published table</th>
                </tr>
              </thead>
              <tbody>
                {RESULTS.map((r) => (
                  <tr key={r.what} className="border-b border-line">
                    <th scope="row" className="py-3 pr-4 text-left font-semibold">
                      {r.what} <span className="font-normal text-muted">· {r.unit}</span>
                    </th>
                    <td className="num py-3 pr-4 text-right text-[19px] text-bad line-through decoration-2">
                      {r.before}
                    </td>
                    <td className="display py-3 text-right text-[30px] leading-none tabular-nums">
                      {r.after}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* --- reports ------------------------------------------------------ */}
        {/* One lead report and two notes beside it, the way a programme
            runs its main story against the shorter ones. */}
        <section className="grid gap-x-10 gap-y-8 pt-16 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          {REPORTS.map((r, i) => (
            <div key={r.title} className={`border-t-[3px] border-text pt-3 ${i === 0 ? 'md:row-span-2' : ''}`}>
              <h3 className={`display leading-[1] ${i === 0 ? 'text-[clamp(1.9rem,3.6vw,2.75rem)]' : 'text-[22px]'}`}>{r.title}</h3>
              <p className={`mt-3 text-text-2 ${i === 0 ? 'max-w-[56ch] text-[18px] leading-relaxed' : 'max-w-[52ch] text-[15px]'}`}>{r.body}</p>
            </div>
          ))}
        </section>

        {/* --- fixtures ----------------------------------------------------- */}
        <section className="pt-16 pb-16">
          <h2 className="shelf-title text-[clamp(2rem,4.4vw,3.25rem)]">Three tools, one account.</h2>
          <ul className="mt-5 border-t-[3px] border-text">
            {FIXTURES.map((f) => (
              <li key={f.href} className="group relative grid grid-cols-[88px_minmax(0,1fr)] items-center gap-x-5 gap-y-2 border-b border-line py-4 hover:bg-text sm:grid-cols-[120px_minmax(0,1fr)_auto]">
                <div className="stage h-[88px] w-[88px] sm:h-[120px] sm:w-[120px]">
                  {f.art && <Image src={f.art} alt="" aria-hidden width={96} height={96} className="h-[78%] w-[78%] object-contain" />}
                </div>
                <div className="min-w-0">
                  <h3 className="display text-[28px] leading-none group-hover:text-bg sm:text-[36px]">{f.title}</h3>
                  <p className="mt-2 max-w-[62ch] text-[15px] text-text-2 group-hover:text-bg">{f.copy}</p>
                </div>
                {/* The whole row is the target; the button is what says so. */}
                <Link href={f.href} className="btn btn-gold col-span-2 justify-self-start after:absolute after:inset-0 sm:col-span-1 sm:justify-self-end">
                  Open
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-6 max-w-[80ch] text-[15px] text-text-2">
            Sample sheets, on generated data:{' '}
            <Link className="font-bold underline hover:bg-kit hover:text-ink" href={samplePath}>Home Village</Link>,{' '}
            <Link className="font-bold underline hover:bg-kit hover:text-ink" href={`${samplePath}/builder`}>Builder Base</Link>,{' '}
            <Link className="font-bold underline hover:bg-kit hover:text-ink" href={`${clanPath}/war`}>a live war</Link>,{' '}
            <Link className="font-bold underline hover:bg-kit hover:text-ink" href={`${clanPath}/league`}>a war league table</Link>.
            The army in the sample still owes{' '}
            {(['elixir', 'dark', 'gold'] as const).filter((k) => s.cost[k] > 0).map((k, i) => (
              <span key={k}>{i > 0 && ', '}<Res amount={s.cost[k]} kind={k} /></span>
            ))}.
          </p>
        </section>
      </div>
    </main>
  );
}
