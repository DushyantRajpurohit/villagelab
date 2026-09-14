import type { RawPlayer } from '@/lib/coc/client';
import { lifetimeRecords } from '@/lib/coc/achievements';
import { fmtInt } from '@/lib/format';
import { Panel, Stat } from '@/components/primitives';

/**
 * What the account has done over its whole life, in the activities medals are
 * paid for.
 *
 * Deliberately not titled as a wallet. The API sends no Raid Medal or League
 * Medal balance, no gems, no magic items and no helper levels, so a figure
 * here is a count of raids and league stars, and says so in its caption.
 */
export function LifetimeRecordPanel({ p }: { p: RawPlayer }) {
  const records = lifetimeRecords(p.achievements);
  if (records.every((r) => r.value == null)) return null;

  return (
    <Panel title="Lifetime record">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {records.map((r) => (
          <Stat key={r.id} label={r.label} value={fmtInt(r.value)} sub={r.unit} />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Lifetime totals from the account&rsquo;s achievements, not balances. The Clash of Clans API
        does not publish Raid Medals, League Medals, gems, magic items or helper levels.
      </p>
    </Panel>
  );
}
