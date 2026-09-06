'use client';

import { useMemo, useState } from 'react';
import { BUILDINGS } from '@/lib/game/buildings';
import { ALL_UNITS } from '@/lib/game/army';
import { MAX_TH } from '@/lib/game/town-halls';
import {
  bucketsFor, buildingRemaining, schedule, unitRemaining, weakest,
  type Buckets,
} from '@/lib/game/planner';
import type { Lane, QueueItem, Resource } from '@/lib/game/types';
import { usePlannerState } from '@/lib/store';
import { fmtDuration, fmtResource } from '@/lib/format';
import { Banner, Chip, Empty, Panel, Res, Stat } from '@/components/primitives';
import { GameIcon } from '@/components/GameIcon';
import { Timeline } from './Timeline';
import { BucketEditor } from './BucketEditor';

const RESOURCES: Resource[] = ['gold', 'elixir', 'dark'];
const RES_LABEL: Record<Resource, string> = { gold: 'Gold', elixir: 'Elixir', dark: 'Dark elixir' };

const CATEGORIES = [
  'all', 'defense', 'trap', 'resource', 'army', 'wall',
  'hero', 'troop', 'spell', 'siege', 'pet',
] as const;
const CAT_LABEL: Record<string, string> = {
  all: 'Everything', defense: 'Defenses', trap: 'Traps', resource: 'Resources',
  army: 'Army buildings', wall: 'Walls', hero: 'Heroes', troop: 'Troops',
  spell: 'Spells', siege: 'Sieges', pet: 'Pets',
};

interface Row {
  type: 'building' | 'unit';
  id: string; name: string; category: string; resource: Resource;
  current: number; cap: number; pending: number; countHere: number;
  cost: number; hours: number; est: boolean;
  next: { cost: number; hours: number; est: boolean } | null;
  buckets?: Buckets;
  lane: Lane;
}

/** Queue ids only need to be unique within this session's list. */
let uidSeq = 0;
const makeUid = (id: string, to: number) => `${id}-${to}-${(uidSeq++).toString(36)}`;

const HEAD = 'sticky top-0 bg-panel px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[.06em] text-muted';

export function PlannerApp() {
  const { state, setState, loaded } = usePlannerState();
  const [cat, setCat] = useState<string>('all');
  const th = state.th;

  const rows = useMemo<Row[]>(() => {
    const buildingRows = BUILDINGS.filter((b) => b.count[th] > 0).map<Row>((b) => {
      const buckets = bucketsFor(state.village[b.id], b, th);
      const r = buildingRemaining(b, buckets, th);
      const w = weakest(buckets);
      return {
        type: 'building', id: b.id, name: b.name, category: b.category, resource: b.resource,
        current: w ?? 0, cap: r.cap, pending: r.pending, countHere: b.count[th],
        cost: r.cost, hours: r.hours, est: r.est, buckets, lane: 'builder',
        next: w != null && w < r.cap ? b.levels[w + 1]! : null,
      };
    });

    const unitRows = ALL_UNITS.filter((u) => u.max[th] > 0).map<Row>((u) => {
      const level = state.lab[u.id] ?? 0;
      const r = unitRemaining(u, level, th);
      return {
        type: 'unit', id: u.id, name: u.name, category: u.kind, resource: u.resource,
        current: level, cap: r.cap, pending: r.pending, countHere: 1,
        cost: r.cost, hours: r.hours, est: r.est,
        lane: u.kind === 'hero' || u.kind === 'pet' ? 'hero' : 'lab',
        next: level < r.cap ? u.levels[level + 1]! : null,
      };
    });

    return [...buildingRows, ...unitRows];
  }, [state.village, state.lab, th]);

  const toMax = useMemo(() => {
    const acc = { gold: 0, elixir: 0, dark: 0 } as Record<Resource, number>;
    let pending = 0, est = false;
    for (const r of rows) { acc[r.resource] += r.cost; pending += r.pending; est ||= r.est; }
    return { acc, pending, est };
  }, [rows]);

  const sched = useMemo(() => schedule(state.queue, state.builders), [state.queue, state.builders]);

  const queueTotals = useMemo(() => {
    const acc = { gold: 0, elixir: 0, dark: 0 } as Record<Resource, number>;
    let est = false;
    for (const q of state.queue) { acc[q.resource] += q.cost; est ||= q.est; }
    return { acc, est };
  }, [state.queue]);

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

  const deficits = RESOURCES
    .map((k) => ({ k, need: queueTotals.acc[k], have: state.resources[k] }))
    .filter((d) => d.need > d.have);

  return (
    <div className="grid gap-4">
      {/* ---------------------------------------------------------- setup */}
      <Panel>
        <div className="flex flex-wrap items-end gap-5">
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            Town Hall
            <select
              value={th}
              onChange={(e) => setState({ th: Number(e.target.value) })}
              className="rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-sm text-text outline-none focus:border-gold/50"
            >
              {Array.from({ length: MAX_TH }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>Town Hall {n}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs text-muted">
            Builders
            <input
              type="number" min={1} max={6} value={state.builders}
              onChange={(e) => setState({ builders: Math.max(1, Math.min(6, Number(e.target.value) || 1)) })}
              className="num w-[64px] rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-sm outline-none focus:border-gold/50"
            />
          </label>

          {RESOURCES.map((k) => (
            <label key={k} className="flex flex-col gap-1.5 text-xs text-muted">
              {RES_LABEL[k]} on hand
              <input
                type="number" min={0} value={state.resources[k]}
                onChange={(e) => setState({
                  resources: { ...state.resources, [k]: Math.max(0, Number(e.target.value) || 0) },
                })}
                className="num w-[130px] rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-sm outline-none focus:border-gold/50"
              />
            </label>
          ))}

          <div className="flex-1" />
          <button
            type="button"
            onClick={() => { if (confirm('Reset recorded building levels for this Town Hall?')) setState({ village: {} }); }}
            className="rounded-md border border-line px-3 py-1.5 text-[13px] text-text-2 hover:bg-panel-2"
          >
            Reset village
          </button>
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel><Stat label={`Everything left at TH${th}`} value={String(toMax.pending)} sub="upgrades outstanding" /></Panel>
        {RESOURCES.map((k) => (
          <Panel key={k}>
            <Stat label={`${RES_LABEL[k]} needed`} value={<Res amount={toMax.acc[k]} kind={k} est={toMax.est} />} />
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
                sub={`${state.builders} builder${state.builders === 1 ? '' : 's'} + lab + heroes`} />
              {RESOURCES.map((k) => (
                <Stat key={k} label={RES_LABEL[k]} value={<Res amount={queueTotals.acc[k]} kind={k} est={queueTotals.est} />} />
              ))}
            </div>

            {deficits.length ? (
              <Banner tone="warn">
                <span><b className="text-text">Short on resources: </b>
                  {deficits.map((d, i) => (
                    <span key={d.k}>{i ? ', ' : ''}{fmtResource(d.need - d.have)} more {RES_LABEL[d.k].toLowerCase()}</span>
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
                          <GameIcon kind={it.kind} id={it.id} level={it.from} size={24} />
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
          {CATEGORIES.filter((c) => c === 'all' || upgradable.some((r) => r.category === c)).map((c) => (
            <button
              key={c} type="button" onClick={() => setCat(c)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                c === cat ? 'bg-gold text-ink' : 'border border-line text-text-2 hover:bg-panel-2'
              }`}
            >
              {CAT_LABEL[c]}
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
                      <GameIcon kind={r.type} id={r.id} level={r.current} size={26} />
                      <span>{r.name}</span>
                      <Chip>{CAT_LABEL[r.category] ?? r.category}</Chip>
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
        <Banner>Levels default to the previous Town Hall ceiling. Correct them here and every figure above updates.</Banner>
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
                        <GameIcon kind="building" id={r.id} level={r.current} size={26} />
                        <span>{r.name}</span><Chip>{CAT_LABEL[r.category] ?? r.category}</Chip>
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
  setState: ReturnType<typeof usePlannerState>['setState'],
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
