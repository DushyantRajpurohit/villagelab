import { TagSearch } from '@/components/TagSearch';
import { Empty, PageHead, Panel } from '@/components/primitives';

export const metadata = { title: 'Clan lookup' };

export default function ClanIndex() {
  return (
    <main className="mx-auto w-full max-w-[1400px] p-5">
      <PageHead
        title="Clan war room"
        sub="Roster health, donation ratios and war form."
        action={<TagSearch basePath="/clan" />}
      />
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
