import Link from 'next/link';
import { TagSearch } from '@/components/TagSearch';
import { Panel } from '@/components/primitives';

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[900px] px-5 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        Village<span className="text-gold">Lab</span>
      </h1>
      <p className="mt-3 max-w-[58ch] text-text-2">
        Progress tracking, upgrade planning and war analytics for Clash of Clans. Look up any player
        to see how close their army is to the ceiling for its Town Hall.
      </p>

      <div className="mt-8">
        <TagSearch basePath="/player" />
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        <Panel title="Player dashboard">
          <p className="text-[13px] text-muted">
            Army progress against Town Hall maximums, rushed-unit detection, and the cost to close the gap.
          </p>
        </Panel>
        <Panel title="Upgrade planner">
          <p className="text-[13px] text-muted">
            Queue upgrades and get a real completion date across builders, laboratory and hero altars.
          </p>
        </Panel>
        <Panel title="War room">
          <p className="text-[13px] text-muted">
            Roster health, donation ratios and war form tracked over time — history the game&rsquo;s own API does not keep.
          </p>
        </Panel>
      </div>

      <p className="mt-10 text-xs text-faint">
        Try a sample profile:{' '}
        <Link className="text-info underline" href="/player/2PP0JCVL9">#2PP0JCVL9</Link>
      </p>
    </main>
  );
}
