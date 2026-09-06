import { TagSearch } from '@/components/TagSearch';
import { Empty, Panel } from '@/components/primitives';

export const metadata = { title: 'Player lookup' };

export default function PlayerIndex() {
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
        <TagSearch basePath="/player" />
      </div>
      <Panel>
        <Empty title="Enter a player tag">
          <p className="mx-auto max-w-[52ch]">
            Tags look like <code className="num">#2PP0JCVL9</code> and appear on the in-game profile
            screen, under your name.
          </p>
        </Empty>
      </Panel>
    </main>
  );
}
