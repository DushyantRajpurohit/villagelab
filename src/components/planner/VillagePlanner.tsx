'use client';

import { useMemo, useState } from 'react';
import {
  bucketsFor, buildingRemaining, schedule, unitRemaining, weakest,
  type Buckets,
} from '@/lib/game/planner';
import type { Lane, QueueItem, Resource } from '@/lib/game/types';
import type { LevelStep } from '@/lib/game/curve';
import { useVillageState, type VillageId } from '@/lib/store';
import { fmtDuration, fmtResource } from '@/lib/format';
import { Banner, Chip, Empty, Panel, Res, Stat } from '@/components/primitives';
import { GameIcon, StorageIcon } from '@/components/GameIcon';
import type { Village as SpriteVillage } from '@/lib/sprites';
import { Timeline } from './Timeline';
import { BucketEditor } from './BucketEditor';

/**
 * The planner, for one village.
 *
 * Both villages are planned by this component and by the same engine in
 * src/lib/game/planner.ts. What differs between them is data, not behaviour —
 * which halls exist, which structures and troops, which currencies, how many
 * builders — so all of it arrives as a `PlannerConfig` rather than as branches
 * through the body. A Builder Base cost cannot reach a Home Village total here
 * because the two never share a component instance or a state slice.
 */

/** The shape both villages' datasets already have. */
export interface PlannerBuilding {
  id: string; name: string; category: string; resource: string;
  count: number[]; max: number[]; levels: (LevelStep | null)[];
}
export interface PlannerUnit {
  id: string; name: string; kind: string; resource: string;
  max: number[]; levels: (LevelStep | null)[];
  /**
   * The level the unit arrives at, where that is not 1. Builder Base troops
   * unlock part-levelled — the Electrofire Wizard is handed over at 17 — so an
   * unrecorded one starts there, not at zero. Left undefined by the Home
   * Village, whose units all start at 1.
   */
  startLevel?: number;
}

export interface PlannerConfig {
  village: VillageId;
  /** Which sprite set the art comes from — the villages share unit ids. */
  sprites: SpriteVillage;
  hallName: string;
  /** "TH" / "BH", for the compact labels in headings. */
  hallShort: string;
  maxHall: number;
  maxBuilders: number;
  /** What the construction lane is called here. */
  buildersLabel: string;
  /** The laboratory's name in this village. */
  labName: string;
  buildings: PlannerBuilding[];
  units: PlannerUnit[];
  /** Currencies this village uses, in display order. */
  resources: Resource[];
  resourceLabel: Record<string, string>;
  /** resource -> the structure that banks it, for the "on hand" icons. */
  storageId: Record<string, string>;
  /** Category filter buttons. */
  categories: string[];
  categoryLabel: Record<string, string>;
  /** Which unit kinds go to the hero lane rather than the lab lane. */
  heroKinds: string[];
  /** Shown under the setup panel where a village needs a caveat. */
  note?: string;
}

interface Row {
  type: 'building' | 'unit';
  id: string; name: string; category: string; resource: Resource;
  current: number; cap: number; pending: number; countHere: number;
  cost: number; hours: number; est: boolean;
  next: { cost: number; hours: number; est: boolean } | null;
  buckets?: Buckets;
  lane: Lane;
}

let uidSeq = 0;
const makeUid = (id: string, to: number) => `${id}-${to}-${(uidSeq++).toString(36)}`;

const HEAD = 'sticky top-0 bg-panel px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[.06em] text-muted';

export function VillagePlanner({ config }: { config: PlannerConfig }) {
  const { state, setState, loaded } = useVillageState(config.village);
  const [cat, setCat] = useState<string>('all');
  const hall = state.hall;

  const rows = useMemo<Row[]>(() => {
    const buildingRows = config.buildings.filter((b) => b.count[hall] > 0).map<Row>((b) => {
      const buckets = bucketsFor(state.village[b.id], b, hall);
      const r = buildingRemaining(b, buckets, hall);
      const w = weakest(buckets);
      return {
        type: 'building', id: b.id, name: b.name, category: b.category,
        resource: b.resource as Resource,
        current: w ?? 0, cap: r.cap, pending: r.pending, countHere: b.count[hall],
        cost: r.cost, hours: r.hours, est: r.est, buckets, lane: 'builder',
        next: w != null && w < r.cap ? b.levels[w + 1]! : null,
      };
    });

    const unitRows = config.units.filter((u) => u.max[hall] > 0).map<Row>((u) => {
      // An unrecorded unit sits at the level it arrives at. Defaulting to zero
      // would ask for `levels[1]`, which is null for anything that unlocks
      // part-levelled, and quietly drop the unit from "available upgrades".
      const level = state.lab[u.id] ?? u.startLevel ?? 0;
      const r = unitRemaining(u, level, hall);
      return {
        type: 'unit', id: u.id, name: u.name, category: u.kind,
        resource: u.resource as Resource,
        current: level, cap: r.cap, pending: r.pending, countHere: 1,
        cost: r.cost, hours: r.hours, est: r.est,
        lane: config.heroKinds.includes(u.kind) ? 'hero' : 'lab',
        next: level < r.cap ? u.levels[level + 1]! : null,
      };
    });

    return [...buildingRows, ...unitRows];
  }, [config, state.village, state.lab, hall]);

  const toMax = useMemo(() => {
    const acc = Object.fromEntries(config.resources.map((k) => [k, 0])) as Record<Resource, number>;
    let pending = 0, est = false;
    for (const r of rows) { acc[r.resource] += r.cost; pending += r.pending; est ||= r.est; }
    return { acc, pending, est };
  }, [rows, config.resources]);

  /**
   * The level each storage reaches at this hall, or null where the hall has no
   * such storage — the field is still shown, so the icon falls back to the
   * resource badge rather than leaving a hole.
   */
  const storageLevel = useMemo(() => {
    const capOf = (id: string) =>
      rows.find((r) => r.type === 'building' && r.id === id)?.cap ?? null;
    return Object.fromEntries(
      config.resources.map((k) => [k, config.storageId[k] ? capOf(config.storageId[k]) : null]),
    ) as Record<string, number | null>;
  }, [rows, config.resources, config.storageId]);

  const sched = useMemo(() => schedule(state.queue, state.builders), [state.queue, state.builders]);

  const queueTotals = useMemo(() => {
    const acc = Object.fromEntries(config.resources.map((k) => [k, 0])) as Record<Resource, number>;
    let est = false;
    for (const q of state.queue) { acc[q.resource] = (acc[q.resource] ?? 0) + q.cost; est ||= q.est; }
    return { acc, est };
  }, [state.queue, config.resources]);

  if (!loaded) {
    return <div className="grid gap-4"><div className="h-32 animate-pulse rounded-[10px] bg-panel-2" /></div>;
  }

  const upgradable = rows.filter((r) => r.next);
  const shown = cat === 'all' ? upgradable : upgradable.filter((r) => r.category === cat);

  const addToQueue = (r: Row) => {
    if (!r.next) return;
    const item: QueueItem = {
      uid: makeUid(r.id, r.current + 1),
      kind: r.type, id: r.id, name: r.name,
      from: r.current, to: r.current + 1,
      cost: r.next.cost, hours: r.next.hours, est: r.next.est,
      resource: r.resource, lane: r.lane,
    };
    setState((s) => ({ queue: [...s.queue, item] }));
  };

  const deficits = config.resources
    .map((k) => ({ k, need: queueTotals.acc[k], have: state.resources[k] ?? 0 }))
    .filter((d) => d.need > d.have);

  return (
    <div className="grid gap-4">
      {/* ---------------------------------------------------------- setup */}
      <Panel>
        <div className="flex flex-wrap items-end gap-5">
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            {config.hallName}
            <select
              value={hall}
              onChange={(e) => setState({ hall: Number(e.target.value) })}
              className="rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-sm text-text outline-none focus:border-gold/50"
            >
              {Array.from({ length: config.maxHall }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{config.hallName} {n}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs text-muted">
            {config.buildersLabel}
            <input
              type="number" min={1} max={config.maxBuilders} value={state.builders}
              onChange={(e) => setState({
                builders: Math.max(1, Math.min(config.maxBuilders, Number(e.target.value) || 1)),
              })}
              className="num w-[64px] rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-sm outline-none focus:border-gold/50"
            />
          </label>

          {config.resources.map((k) => (
            <label key={k} className="flex flex-col gap-1.5 text-xs text-muted">
              {/* Banked, not owed — so the storage that holds it, not the coin. */}
              <span className="flex items-center gap-1.5">
                <StorageIcon kind={k} level={storageLevel[k] ?? null} size={20} village={config.sprites} />
                {config.resourceLabel[k]} on hand
              </span>
              <input
                type="number" min={0} value={state.resources[k] ?? 0}
                onChange={(e) => setState((s) => ({
                  resources: { ...s.resources, [k]: Math.max(0, Number(e.target.value) || 0) },
                }))}
                className="num w-[130px] rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-sm outline-none focus:border-gold/50"
              />
            </label>
          ))}

          <div className="flex-1" />
          <button
            type="button"
            onClick={() => {
              if (confirm(`Reset recorded building levels for this ${config.hallName}?`)) {
                setState({ village: {} });
              }
            }}
            className="rounded-md border border-line px-3 py-1.5 text-[13px] text-text-2 hover:bg-panel-2"
          >
            Reset village
          </button>
        </div>
        {config.note && <p className="mt-3 text-xs text-muted">{config.note}</p>}
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <Stat label={`Everything left at ${config.hallShort}${hall}`} value={String(toMax.pending)}
            sub="upgrades outstanding" />
        </Panel>
        {config.resources.map((k) => (
          <Panel key={k}>
            <Stat label={`${config.resourceLabel[k]} needed`}
              value={<Res amount={toMax.acc[k]} kind={k} est={toMax.est} />} />
          </Panel>
        ))}
      </div>

      {/* ---------------------------------------------------------- queue */}
      <Panel
        title="Build queue"
        action={state.queue.length ? (
          <button type="button" onClick={() => setState({ queue: [] })}
            className="rounded px-2 py-1 text-xs text-bad hover:bg-panel-2">Clear all</button>
        ) : null}
      >
        {state.queue.length === 0 ? (
          <Empty title="Queue is empty">
            <p>Add upgrades below and the planner will schedule them across your builders.</p>
          </Empty>
        ) : (
          <div className="grid gap-3.5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Finishes in" value={fmtDuration(sched.finishHours)}
                sub={`${state.builders} builder${state.builders === 1 ? '' : 's'} + ${config.labName.toLowerCase()} + heroes`} />
              {config.resources.map((k) => (
                <Stat key={k} label={config.resourceLabel[k]}
                  value={<Res amount={queueTotals.acc[k]} kind={k} est={queueTotals.est} />} />
              ))}
            </div>

            {deficits.length ? (
              <Banner tone="warn">
                <span><b className="text-text">Short on resources: </b>
                  {deficits.map((d, i) => (
                    <span key={d.k}>
                      {i ? ', ' : ''}{fmtResource(d.need - d.have)} more {config.resourceLabel[d.k].toLowerCase()}
                    </span>
                  ))}
                </span>
              </Banner>
            ) : (
              <Banner>You have enough banked for this whole queue.</Banner>
            )}

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className={`${HEAD} text-right`}>#</th>
                    <th className={`${HEAD} text-left`}>Upgrade</th>
                    <th className={`${HEAD} text-right`}>Cost</th>
                    <th className={`${HEAD} text-right`}>Duration</th>
                    <th className={`${HEAD} text-right`}>Done</th>
                    <th className={HEAD} />
                  </tr>
                </thead>
                <tbody>
                  {sched.items.map((it, i) => (
                    <tr key={it.uid} className="border-b border-line/40 last:border-0 hover:bg-panel-2">
                      <td className="num px-3 py-2 text-right text-faint">{i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* The level you have now, not the one queued — the
                              art should match the village you can go look at. */}
                          <GameIcon kind={it.kind} id={it.id} level={it.from}
                            village={config.sprites} size={24} />
                          <span>{it.name}</span>
                          <Chip>{it.from} → {it.to}</Chip>
                          <Chip tone={it.laneType === 'lab' ? 'info' : it.laneType === 'hero' ? 'gold' : 'plain'}>
                            {it.laneType}
                          </Chip>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right"><Res amount={it.cost} kind={it.resource} est={it.est} /></td>
                      <td className="num px-3 py-2 text-right">{fmtDuration(it.hours)}</td>
                      <td className="num px-3 py-2 text-right text-muted">{fmtDuration(it.end)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <MoveBtn label="↑" onClick={() => move(setState, it.uid, -1)} />
                          <MoveBtn label="↓" onClick={() => move(setState, it.uid, 1)} />
                          <MoveBtn label="✕" tone="bad"
                            onClick={() => setState((s) => ({ queue: s.queue.filter((q) => q.uid !== it.uid) }))} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Timeline sched={sched} builders={state.builders} />
          </div>
        )}
      </Panel>

      {/* ------------------------------------------------------ available */}
      <Panel title="Available upgrades" action={<Chip>{upgradable.length} available</Chip>}>
        <div className="flex flex-wrap gap-1.5">
          {config.categories.filter((c) => c === 'all' || upgradable.some((r) => r.category === c)).map((c) => (
            <button
              key={c} type="button" onClick={() => setCat(c)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                c === cat ? 'bg-gold text-ink' : 'border border-line text-text-2 hover:bg-panel-2'
              }`}
            >
              {config.categoryLabel[c] ?? c}
            </button>
          ))}
        </div>
      </Panel>

      <Panel tight>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={`${HEAD} text-left`}>Target</th>
                <th className={`${HEAD} text-right`}>Next</th>
                <th className={`${HEAD} text-right`}>Cap</th>
                <th className={`${HEAD} text-right`}>Cost</th>
                <th className={`${HEAD} text-right`}>Time</th>
                <th className={`${HEAD} text-right`}>All to cap</th>
                <th className={HEAD} />
              </tr>
            </thead>
            <tbody>
              {[...shown].sort((a, b) => (a.next!.cost) - (b.next!.cost)).map((r) => (
                <tr key={`${r.type}-${r.id}`} className="border-b border-line/40 last:border-0 hover:bg-panel-2">
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <GameIcon kind={r.type} id={r.id} level={r.current} village={config.sprites} size={26} />
                      <span>{r.name}</span>
                      <Chip>{config.categoryLabel[r.category] ?? r.category}</Chip>
                      {r.type === 'building' && r.countHere > 1 && (
                        <Chip title="Structures of this type still below the cap">{r.pending}/{r.countHere} left</Chip>
                      )}
                    </div>
                  </td>
                  <td className="num px-3 py-2 text-right">{r.current} → {r.current + 1}</td>
                  <td className="num px-3 py-2 text-right text-muted">{r.cap}</td>
                  <td className="px-3 py-2 text-right"><Res amount={r.next!.cost} kind={r.resource} est={r.next!.est} /></td>
                  <td className="num px-3 py-2 text-right">{fmtDuration(r.next!.hours)}</td>
                  <td className="px-3 py-2 text-right"><Res amount={r.cost} kind={r.resource} est={r.est} /></td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => addToQueue(r)}
                      className="rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-panel-3">
                      Queue
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* -------------------------------------------------------- village */}
      <Panel title="Your village" action={<Chip>stored in this browser</Chip>}>
        <Banner>
          Levels default to the previous {config.hallName} ceiling. Correct them here and every
          figure above updates.
        </Banner>
      </Panel>

      <Panel tight>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={`${HEAD} text-left`}>Building</th>
                <th className={`${HEAD} text-right`}>Count</th>
                <th className={`${HEAD} text-left`}>Levels</th>
                <th className={`${HEAD} text-right`}>Left</th>
                <th className={`${HEAD} text-right`}>To cap</th>
              </tr>
            </thead>
            <tbody>
              {rows.filter((r) => r.type === 'building')
                .sort((a, b) => b.cost - a.cost)
                .map((r) => (
                  <tr key={r.id} className="border-b border-line/40 last:border-0 hover:bg-panel-2">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <GameIcon kind="building" id={r.id} level={r.current} village={config.sprites} size={26} />
                        <span>{r.name}</span>
                        <Chip>{config.categoryLabel[r.category] ?? r.category}</Chip>
                      </div>
                    </td>
                    <td className="num px-3 py-2 text-right">{r.countHere}</td>
                    <td className="px-3 py-2">
                      <BucketEditor
                        buckets={r.buckets!} count={r.countHere} cap={r.cap} name={r.name}
                        onChange={(next) => setState((s) => ({ village: { ...s.village, [r.id]: next } }))}
                      />
                    </td>
                    <td className={`num px-3 py-2 text-right ${r.pending ? 'text-warn' : 'text-ok'}`}>
                      {r.pending || 'max'}
                    </td>
                    <td className="px-3 py-2 text-right"><Res amount={r.cost} kind={r.resource} est={r.est} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function MoveBtn({ label, onClick, tone }: { label: string; onClick: () => void; tone?: 'bad' }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded px-1.5 py-0.5 text-xs hover:bg-panel-3 ${tone === 'bad' ? 'text-bad' : 'text-muted'}`}>
      {label}
    </button>
  );
}

function move(
  setState: ReturnType<typeof useVillageState>['setState'],
  uid: string,
  dir: number,
) {
  setState((s) => {
    const i = s.queue.findIndex((q) => q.uid === uid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= s.queue.length) return {};
    const next = [...s.queue];
    [next[i], next[j]] = [next[j], next[i]];
    return { queue: next };
  });
}
