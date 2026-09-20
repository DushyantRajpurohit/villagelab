import { TagSearch } from '@/components/TagSearch';
import { Empty, PageHead, Panel } from '@/components/primitives';

export const metadata = { title: 'Player lookup' };

export default function PlayerIndex() {
  return (
    <main className="mx-auto w-full max-w-[1400px] p-5">
      <PageHead
        title="Player dashboard"
        sub="How close an account is to the ceiling for its Town Hall, what closing the gap costs, and whether it is rushed."
        action={<TagSearch basePath="/player" />}
      />
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
