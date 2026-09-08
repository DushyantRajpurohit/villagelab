import type { ReactNode } from 'react';
import { Chip, Panel, Res } from '@/components/primitives';
import { GameIcon } from '@/components/GameIcon';
import { fmtDuration } from '@/lib/format';
import { builderBuildingsAtBH } from '@/lib/game/builder-base';
import { BUILDINGS_BY_ID, SUPERCHARGES, buildingsAtTH } from '@/lib/game/buildings';
import { MAX_TH } from '@/lib/game/town-halls';
import type { Resource } from '@/lib/game/types';
import type { Village } from '@/lib/sprites';

/**
 * What a hall can build, and what a full one costs.
 *
 * This is deliberately not a claim about the account. The Supercell API exposes
 * unit levels but no building levels for either village, so nobody can say what
 * this player's Crusher is actually at — the planner exists for recording that
 * by hand. What *is* knowable is what the hall allows: which structures, how
 * many of each, and how far each upgrades. The panels say so rather than
 * implying the numbers are theirs.
 *
 * Both villages' figures are published values now, read from each structure's
 * own per-level table, so neither total is an estimate and the "≈" appears on
 * neither. It is still wired up: `est` rides on every level, and the panel says
 * which it is rather than assuming.
 */

const CATEGORY_LABEL: Record<string, string> = {
  defense: 'Defenses',
  trap: 'Traps',
  resource: 'Resource buildings',
  army: 'Army buildings',
  wall: 'Walls',
  other: 'Other',
};
const CATEGORY_ORDER = ['defense', 'trap', 'resource', 'army', 'wall', 'other'];

/** One hall's roster, flattened to what this panel needs from either village. */
interface Entry {
  id: string;
  name: string;
  category: string;
  resource: Resource;
  countHere: number;
  maxHere: number;
  startLevel: number;
  levels: ({ cost: number; hours: number; est: boolean } | null)[];
}

export function BuilderVillageBuildings({ bh }: { bh: number }) {
  const all: Entry[] = builderBuildingsAtBH(bh)
    .filter((b) => b.id !== 'builder_hall')
    .map((b) => ({
      id: b.id, name: b.name, category: b.category, resource: b.resource,
      countHere: b.countHere, maxHere: b.maxHere, startLevel: b.startLevel,
      levels: b.levels,
    }));

  return (
    <VillageBuildings
      title={`What Builder Hall ${bh} can build`}
      entries={all}
      village="builder"
      resources={['gold', 'elixir']}
      label={(k) => `Builder ${k} to max them all`}
    />
  );
}

export function HomeVillageBuildings({ th }: { th: number }) {
  const all: Entry[] = buildingsAtTH(th).map((b) => ({
    id: b.id, name: b.name, category: b.category, resource: b.resource,
    countHere: b.countHere, maxHere: b.maxHere, startLevel: 0, levels: b.levels,
  }));

  // Supercharges are a Town Hall 18 mechanic and only apply to a structure
  // already at its ceiling, so they are named at that hall and nowhere else.
  // They are deliberately absent from the total above.
  const charged = th < MAX_TH ? []
    : Object.keys(SUPERCHARGES).filter((id) => BUILDINGS_BY_ID[id].count[th] > 0);

  return (
    <VillageBuildings
      title={`What Town Hall ${th} can build`}
      entries={all}
      village="home"
      resources={['gold', 'elixir', 'dark']}
      label={(k) => `${k === 'dark' ? 'Dark elixir' : k} to max them all`}
      footnote={charged.length > 0 && (
        <>
          {' '}Past that, {charged.length} of them can be <em>supercharged</em> — extra levels a
          maxed structure can take here, which the game removes again when a real level is added.
          They are not counted above.
        </>
      )}
    />
  );
}

function VillageBuildings({ title, entries, village, resources, label, footnote }: {
  title: string;
  entries: Entry[];
  village: Village;
  resources: Resource[];
  label: (k: Resource) => string;
  footnote?: ReactNode;
}) {
  if (!entries.length) return null;

  // Everything from the level it is placed at to the hall's ceiling, times how
  // many of it the hall allows.
  const cost = Object.fromEntries(resources.map((k) => [k, 0])) as Record<Resource, number>;
  let hours = 0;
  let structures = 0;
  let est = false;
  for (const b of entries) {
    structures += b.countHere;
    for (let l = Math.max(1, b.startLevel) + 1; l <= b.maxHere; l++) {
      const step = b.levels[l];
      if (!step) continue;
      cost[b.resource] += step.cost * b.countHere;
      hours += step.hours * b.countHere;
      est ||= step.est;
    }
  }

  return (
    <>
      <Panel title={title} action={<Chip>{structures} structures</Chip>}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Figure label="Structures allowed" value={String(structures)}
            sub={`${entries.length} kinds`} />
          {resources.filter((k) => cost[k] > 0).map((k) => (
            <div key={k}>
              <div className="text-[11px] uppercase tracking-[.06em] text-muted">{label(k)}</div>
              <div className="text-[22px] font-semibold">
                <Res amount={cost[k]} kind={k} est={est} village={village} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          The hall&rsquo;s own allowance, not this account&rsquo;s village — the API exposes no
          building levels for either village. Record yours in the planner to see what is actually
          left. {fmtDuration(hours)} of building at one builder
          {est ? ', and the figures marked ≈ are interpolated rather than verified.' : ', from published values.'}
          {footnote}
        </p>
      </Panel>

      {CATEGORY_ORDER.filter((c) => entries.some((b) => b.category === c)).map((cat) => {
        const group = entries.filter((b) => b.category === cat);
        return (
          <Panel key={cat} title={CATEGORY_LABEL[cat] ?? cat}
            action={<Chip>{group.reduce((n, b) => n + b.countHere, 0)}</Chip>} tight>
            <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 xl:grid-cols-4">
              {group.map((b) => (
                <div key={b.id}
                  className="flex items-center gap-2.5 rounded-[10px] border border-line bg-panel-2 px-2.5 py-2">
                  <GameIcon kind="building" id={b.id} level={b.maxHere} village={village} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px]">{b.name}</div>
                    <div className="num text-[11px] text-muted">
                      {b.countHere > 1 && <span className="text-text-2">×{b.countHere} </span>}
                      to level {b.maxHere}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        );
      })}
    </>
  );
}

function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[.06em] text-muted">{label}</div>
      <div className="num text-[22px] font-semibold">{value}</div>
      {sub && <div className="text-[11px] text-faint">{sub}</div>}
    </div>
  );
}
