'use client';

import type { Buckets } from '@/lib/game/planner';
import { rebalance } from '@/lib/game/planner';

/**
 * Compact level-bucket editor: one input per level that currently holds
 * structures, plus a "+" that promotes a single structure to the next level.
 * Totals are always reconciled back to the building's count at this Town Hall.
 */
export function BucketEditor({ buckets, count, cap, name, onChange }: {
  buckets: Buckets;
  count: number;
  cap: number;
  name: string;
  onChange: (next: Buckets) => void;
}) {
  const levels = Object.keys(buckets)
    .map(Number)
    .filter((l) => buckets[l] > 0)
    .sort((a, b) => a - b);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {levels.map((lvl) => (
        <div key={lvl} className="flex items-center gap-1 rounded border border-line bg-panel-2 px-1.5 py-0.5">
          <span className="text-[11px] text-muted">L{lvl}</span>
          <input
            type="number"
            min={0}
            max={count}
            value={buckets[lvl]}
            aria-label={`${name} at level ${lvl}`}
            onChange={(e) => {
              const n = Math.max(0, Math.min(count, Number(e.target.value) || 0));
              const next = { ...buckets, [lvl]: n };
              if (!n) delete next[lvl];
              onChange(rebalance(next, count));
            }}
            className="num w-[46px] rounded bg-transparent px-1 py-0.5 text-xs outline-none focus:bg-panel-3"
          />
          {lvl < cap && (
            <button
              type="button"
              title={`Move one ${name} from level ${lvl} to ${lvl + 1}`}
              onClick={() => {
                const next = { ...buckets };
                next[lvl] -= 1;
                if (!next[lvl]) delete next[lvl];
                next[lvl + 1] = (next[lvl + 1] || 0) + 1;
                onChange(next);
              }}
              className="rounded px-1 text-xs text-muted hover:bg-panel-3 hover:text-text"
            >
              +
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        title={`Set every ${name} to the level cap (${cap})`}
        onClick={() => onChange({ [cap]: count })}
        className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted hover:bg-panel-3 hover:text-text"
      >
        max
      </button>
    </div>
  );
}
