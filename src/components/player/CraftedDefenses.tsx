import { Chip, Panel, Res, Stat } from '@/components/primitives';
import { CraftedIcon, RESOURCE_NAME } from '@/components/GameIcon';
import { fmtDuration, fmtInt } from '@/lib/format';
import {
  CRAFTING_PHASE, craftedAtTH, craftedCostToMax, moduleCostToMax, phaseCostToMax,
  phaseHasEnded,
} from '@/lib/game/crafted';
import { PER_CHARGE_LEVEL, PER_MODULE_LEVEL, sparkyAtTH } from '@/lib/game/sparky';
import type { Resource } from '@/lib/game/types';

/**
 * What the Crafting Station can be turned into, and what it pays.
 *
 * A panel of its own rather than a row in "what this hall can build", for the
 * same reason supercharges are not in that total: these are temporary. The
 * station is a structure and appears there; the defenses it becomes are not
 * structures, cost far more than the station's nothing, and are taken away when
 * the phase ends. Folding 216,000,000 gold of expiring upgrades into "what it
 * costs to max your defences" would misstate the goal.
 *
 * The panel is also the only place in the app that shows a *yield*. Everything
 * else here answers what something costs; Sparky Stones are what the game pays
 * back for spending on something it intends to remove, so they are shown beside
 * the bill rather than anywhere near a village total.
 */

const RESOURCES: Resource[] = ['gold', 'elixir', 'dark'];

/** 1 August 2026, from an ISO date, without pulling in a date library. */
function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

export function CraftedDefenses({ th }: { th: number }) {
  const here = craftedAtTH(th);
  if (!here.length) return null;

  const phase = phaseCostToMax(th);
  const sparky = sparkyAtTH(th);
  const over = phaseHasEnded();

  return (
    <>
      <Panel
        title={`Crafted Defenses at TH${th}`}
        action={
          <Chip tone={over ? 'warn' : 'info'}>
            Phase {CRAFTING_PHASE.number}
            {over ? ' — ended' : ''}
          </Chip>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Defenses this phase"
            value={String(here.length)}
            sub="one Crafting Station, swapped freely"
          />
          {RESOURCES.filter((k) => phase.cost[k] > 0).map((k) => (
            <div key={k}>
              <div className="text-[11px] uppercase tracking-[.06em] text-muted">
                {RESOURCE_NAME[k]} for all {here.length}
              </div>
              <div className="text-[22px] font-semibold">
                <Res amount={phase.cost[k]} kind={k} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
          <div>
            <div className="text-[11px] uppercase tracking-[.06em] text-muted">
              Sparky Stones earned
            </div>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[22px] font-semibold">
                <Res amount={sparky.crafted} kind="sparky" />
              </span>
              <span className="text-[12px] text-muted">
                {PER_MODULE_LEVEL} per module level
              </span>
            </div>
            {sparky.supercharge > 0 && (
              <div className="mt-1.5 text-[12px] text-muted">
                Plus{' '}
                <span className="num text-sparky">{fmtInt(sparky.supercharge)}</span>
                {' '}from supercharging, at {PER_CHARGE_LEVEL} a charge.
              </div>
            )}
          </div>
          <p className="text-xs text-muted">
            Sparky Stones are the one thing here that is earned rather than spent. Nothing in
            either village is built with them and no storage banks them — they buy cosmetics in
            the Fancy Shop, and are capped rather than stored. They are counted from exactly the
            two tracks kept out of every cost-to-max total, which is the point of them: they are
            what the game pays back for spending on upgrades it intends to take away.
          </p>
        </div>

        <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
          {over ? (
            <>
              <strong className="text-warn">Phase {CRAFTING_PHASE.number} ended on{' '}
              {fmtDate(CRAFTING_PHASE.until)}</strong>, so these three are no longer craftable and
              the set that replaced them is not recorded here yet.
            </>
          ) : (
            <>
              Crafting Phase {CRAFTING_PHASE.number} runs to {fmtDate(CRAFTING_PHASE.until)}, when
              these three are removed and three others take their place.
            </>
          )}
          {' '}A Crafted Defense has no level of its own to buy: it is three modules of ten,
          arriving at level 3 and reaching {here[0].maxLevel} with all three maxed, and each module
          spends a different currency. Choosing and swapping is free, so the bill is only for what
          is upgraded. None of it is in the totals above or in what the hall can build —
          it expires.
        </p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        {here.map((d) => {
          const cost = craftedCostToMax(d, th);
          return (
            <Panel key={d.id} title={d.name}
              action={<Chip>to {d.maxHere}</Chip>}>
              <div className="flex items-start gap-3">
                <CraftedIcon id={d.id} level={d.maxHere} size={64} alt={d.name} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] uppercase tracking-[.06em] text-muted">
                    To max here
                  </div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    {RESOURCES.filter((k) => cost.cost[k] > 0).map((k) => (
                      <span key={k} className="text-[15px] font-semibold">
                        <Res amount={cost.cost[k]} kind={k} />
                      </span>
                    ))}
                  </div>
                  <div className="mt-1 text-[11px] text-faint">
                    {fmtDuration(cost.hours)} of building
                    {cost.levels > 0 && <> · {cost.levels} module levels</>}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-1.5 border-t border-line pt-3">
                {d.modules.map((m) => {
                  const mc = moduleCostToMax(m, 1, th);
                  return (
                    <div key={m.index}
                      className="flex items-center gap-2 rounded-[8px] border border-line bg-panel-2 px-2.5 py-1.5">
                      <div className="min-w-0 flex-1 truncate text-[12px]">{m.name}</div>
                      <div className="num shrink-0 text-[11px] text-faint">to {m.max[th]}</div>
                      <div className="shrink-0 text-[11px] font-semibold">
                        <Res amount={mc.cost[m.resource]} kind={m.resource} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
