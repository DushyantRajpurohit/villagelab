'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { QueueItem, Resource } from './game/types';
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
 */

const KEY = 'villagelab.v1';

export interface PlannerState {
  th: number;
  builders: number;
  /** buildingId -> level buckets, e.g. { cannon: { 18: 4, 19: 3 } } */
  village: Record<string, Buckets>;
  /** unitId -> current level */
  lab: Record<string, number>;
  queue: QueueItem[];
  /** Saved base layouts, newest first. */
  layouts: BaseLayout[];
  resources: Record<Resource, number>;
  playerTag: string;
  clanTag: string;
}

export const DEFAULT_STATE: PlannerState = Object.freeze({
  th: 14,
  builders: 6,
  village: {},
  lab: {},
  queue: [],
  layouts: [],
  resources: { gold: 0, elixir: 0, dark: 0 },
  playerTag: '',
  clanTag: '',
});

function read(): PlannerState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    return { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) };
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

export function exportState(state: PlannerState): string {
  return JSON.stringify({ app: 'villagelab', version: 1, exported: new Date().toISOString(), state }, null, 2);
}

export function parseImport(text: string): PlannerState {
  const parsed = JSON.parse(text);
  const incoming = parsed?.state ?? parsed;
  if (typeof incoming !== 'object' || incoming === null) throw new Error('Not a VillageLab export');
  return { ...structuredClone(DEFAULT_STATE), ...incoming };
}
