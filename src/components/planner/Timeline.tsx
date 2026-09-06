import { fmtDuration } from '@/lib/format';
import type { Schedule } from '@/lib/game/planner';

const LANE_COLOR = { gold: 'bg-gold', elixir: 'bg-elixir', dark: 'bg-dark' } as const;

/** One row per builder / lab / hero lane, bars positioned by scheduled start. */
export function Timeline({ sched, builders }: { sched: Schedule; builders: number }) {
  const span = Math.max(1, sched.finishHours);

  const lanes = [
    ...Array.from({ length: builders }, (_, i) => ({ type: 'builder' as const, index: i, label: `Builder ${i + 1}` })),
    { type: 'lab' as const, index: 0, label: 'Laboratory' },
    { type: 'hero' as const, index: 0, label: 'Hero altar' },
  ].filter((l) => sched.items.some((it) => it.laneType === l.type && it.laneIndex === l.index));

  if (!lanes.length) return null;

  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[.08em] text-muted">Timeline</h3>
      <div className="grid gap-1">
        {lanes.map((lane) => (
          <div key={`${lane.type}-${lane.index}`} className="flex items-center gap-2.5">
            <div className="w-[92px] shrink-0 text-xs text-muted">{lane.label}</div>
            <div className="relative h-5 flex-1 overflow-hidden rounded bg-panel-2">
              {sched.items
                .filter((it) => it.laneType === lane.type && it.laneIndex === lane.index)
                .map((it) => (
                  <div
                    key={it.uid}
                    title={`${it.name} ${it.from}→${it.to} · ${fmtDuration(it.hours)}`}
                    className={`absolute inset-y-0.5 rounded-sm opacity-80 ${LANE_COLOR[it.resource]}`}
                    style={{
                      left: `${(it.start / span) * 100}%`,
                      width: `${Math.max(0.6, (it.hours / span) * 100)}%`,
                    }}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-faint">
        <span>now</span>
        <span>{fmtDuration(sched.finishHours)}</span>
      </div>
    </div>
  );
}
