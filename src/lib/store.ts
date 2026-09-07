'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { QueueItem, VillageId } from './game/types';
import type { Buckets } from './game/planner';
import type { BaseLayout } from './base/layout';

/**
 * Client-side persistence.
 *
 * A player's village levels and queue are private working state that only they
 * care about — putting it in Postgres would cost a write on every keystroke and
 * buy nothing. localStorage keeps the free tier free and lets the planner work
 * with no account.
 *
 * Implemented as an external store read through `useSyncExternalStore` rather
 * than `useState` + `useEffect`. React renders `getServerSnapshot` on the
 * server and during hydration, then switches to the real value — so there is no
 * hydration mismatch and no cascading render from a setState-in-effect.
 *
 * State is stored **per village**. The Home Village and the Builder Base have
 * separate halls, separate builders, separate currencies and separate layouts;
 * the game never mixes them and neither does this. That separation is what
 * makes it impossible for a Builder Base cost to land in a Home Village total —
 * not discipline at each call site, but the shape of the state itself.
 */

const KEY = 'villagelab.v2';
/** The pre-split store: one flat Home Village, no Builder Base. */
const KEY_V1 = 'villagelab.v1';

export type { VillageId };

export interface VillageState {
  /** Town Hall for the home village, Builder Hall for the second. */
  hall: number;
  /** Builders available to this village's construction lane. */
  builders: number;
  /** buildingId -> level buckets, e.g. { cannon: { 18: 4, 19: 3 } } */
  village: Record<string, Buckets>;
  /** unitId -> current level */
  lab: Record<string, number>;
  queue: QueueItem[];
  /** Saved base layouts for this village, newest first. */
  layouts: BaseLayout[];
  /** Resource on hand. The home village adds dark elixir; the Builder Base has no such thing. */
  resources: Record<string, number>;
}

export interface PlannerState {
  home: VillageState;
  builder: VillageState;
  playerTag: string;
  clanTag: string;
}

const emptyVillage = (hall: number, builders: number, resources: Record<string, number>): VillageState => ({
  hall, builders, village: {}, lab: {}, queue: [], layouts: [], resources,
});

export const DEFAULT_STATE: PlannerState = Object.freeze({
  home: emptyVillage(14, 6, { gold: 0, elixir: 0, dark: 0 }),
  // One Master Builder, until O.T.T.O takes over the second at Builder Hall 9.
  builder: emptyVillage(9, 2, { gold: 0, elixir: 0 }),
  playerTag: '',
  clanTag: '',
});

const mergeVillage = (base: VillageState, incoming: unknown): VillageState => {
  if (typeof incoming !== 'object' || incoming === null) return base;
  const v = incoming as Partial<VillageState>;
  return {
    ...base,
    ...v,
    resources: { ...base.resources, ...(v.resources ?? {}) },
  };
};

const merge = (incoming: Partial<PlannerState>): PlannerState => ({
  ...structuredClone(DEFAULT_STATE),
  ...incoming,
  home: mergeVillage(structuredClone(DEFAULT_STATE.home), incoming.home),
  builder: mergeVillage(structuredClone(DEFAULT_STATE.builder), incoming.builder),
});

/**
 * Lift a pre-split save into the home village.
 *
 * The old store was one flat Home Village — `th`, `village`, `lab`, `queue`,
 * `layouts`, `resources` at the top level. Dropping it would silently erase a
 * village someone spent an evening recording, so it is read once and moved
 * across; the Builder Base starts empty because there was never anything in it.
 */
function migrateV1(raw: string): PlannerState | null {
  try {
    const old = JSON.parse(raw) as Record<string, unknown>;
    if (typeof old !== 'object' || old === null || !('th' in old)) return null;
    return merge({
      home: {
        hall: Number(old.th) || DEFAULT_STATE.home.hall,
        builders: Number(old.builders) || DEFAULT_STATE.home.builders,
        village: (old.village as VillageState['village']) ?? {},
        lab: (old.lab as VillageState['lab']) ?? {},
        queue: (old.queue as QueueItem[]) ?? [],
        layouts: (old.layouts as BaseLayout[]) ?? [],
        resources: { ...DEFAULT_STATE.home.resources, ...((old.resources as Record<string, number>) ?? {}) },
      },
      playerTag: typeof old.playerTag === 'string' ? old.playerTag : '',
      clanTag: typeof old.clanTag === 'string' ? old.clanTag : '',
    });
  } catch {
    return null;
  }
}

function read(): PlannerState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(JSON.parse(raw));
    const old = localStorage.getItem(KEY_V1);
    if (old) {
      const migrated = migrateV1(old);
      // The v1 key is left where it is: a migration that also deletes is a
      // migration you cannot re-run after finding a bug in it.
      if (migrated) return migrated;
    }
    return structuredClone(DEFAULT_STATE);
  } catch {
    // private mode, cleared storage, or corrupt JSON — defaults are always valid
    return structuredClone(DEFAULT_STATE);
  }
}

let snapshot: PlannerState | null = null;
const listeners = new Set<() => void>();

/** Snapshot identity must be stable between changes or React re-renders forever. */
function getSnapshot(): PlannerState {
  snapshot ??= read();
  return snapshot;
}

const getServerSnapshot = (): PlannerState => DEFAULT_STATE;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const l of listeners) l();
}

function write(next: PlannerState) {
  snapshot = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota exceeded or storage disabled — keep working in memory */
  }
  emit();
}

export function usePlannerState() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // False on the server and during hydration, true once the real store is live.
  const loaded = useSyncExternalStore(subscribe, () => true, () => false);

  const setState = useCallback(
    (patch: Partial<PlannerState> | ((s: PlannerState) => Partial<PlannerState>)) => {
      const prev = getSnapshot();
      write({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) });
    },
    [],
  );

  const reset = useCallback(() => {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    write(structuredClone(DEFAULT_STATE));
  }, []);

  return { state, setState, reset, loaded };
}

/**
 * One village's slice, with a setter scoped to it.
 *
 * Callers that only ever touch one village take this instead of the whole
 * store, so a Builder Base screen has no way to write to the Home Village even
 * by accident.
 */
export function useVillageState(id: VillageId) {
  const { state, setState, loaded } = usePlannerState();

  const setVillage = useCallback(
    (patch: Partial<VillageState> | ((v: VillageState) => Partial<VillageState>)) => {
      setState((s) => {
        const prev = s[id];
        return { [id]: { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) } };
      });
    },
    [setState, id],
  );

  return useMemo(
    () => ({ village: id, state: state[id], setState: setVillage, loaded }),
    [id, state, setVillage, loaded],
  );
}

export function exportState(state: PlannerState): string {
  return JSON.stringify({ app: 'villagelab', version: 2, exported: new Date().toISOString(), state }, null, 2);
}

export function parseImport(text: string): PlannerState {
  const parsed = JSON.parse(text);
  const incoming = parsed?.state ?? parsed;
  if (typeof incoming !== 'object' || incoming === null) throw new Error('Not a VillageLab export');
  // A version-1 export is a flat home village; run it through the same lift.
  if ('th' in incoming) {
    const migrated = migrateV1(JSON.stringify(incoming));
    if (migrated) return migrated;
  }
  return merge(incoming as Partial<PlannerState>);
}
