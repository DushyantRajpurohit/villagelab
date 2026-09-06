import { TagSearch } from '@/components/TagSearch';
import { Empty, Panel } from '@/components/primitives';

export const metadata = { title: 'Clan lookup' };

export default function ClanIndex() {
  return (
    <main className="mx-auto w-full max-w-[1400px] p-5">
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="display text-[22px]">Clan war room</h1>
          <p className="mt-1 max-w-[62ch] text-[13px] text-muted">
            Roster health, donation ratios and war form.
          </p>
        </div>
        <div className="flex-1" />
        <TagSearch basePath="/clan" />
      </div>
      <Panel>
        <Empty title="Enter a clan tag">
          <p className="mx-auto max-w-[52ch]">
            Clan tags look like <code className="num">#2Y0LQ8JC</code> and appear under the clan name in game.
          </p>
        </Empty>
      </Panel>
    </main>
  );
}
