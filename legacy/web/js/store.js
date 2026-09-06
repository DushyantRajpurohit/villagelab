/**
 * Local persistence.
 *
 * The Supercell API is read-only and exposes no building levels, so a player's
 * village state, upgrade queue and base layouts live in this browser. Every
 * read is defensive — a cleared localStorage must degrade to defaults, never
 * throw.
 */
const KEY = 'clashverse.v1';

const DEFAULTS = {
  playerTag: '',
  clanTag: '',
  th: 14,
  builders: 6,
  /** buildingId -> array of instance levels, e.g. { cannon: [15,15,14,...] } */
  village: {},
  /** unitId -> current level */
  lab: {},
  /** queue entries: {uid, kind:'building'|'unit', id, from, to, cost, hours, resource, est} */
  queue: [],
  /** saved base layouts: {id, name, th, tiles:[{id,x,y}], updated} */
  layouts: [],
  resources: { gold: 0, elixir: 0, dark: 0 },
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    return { ...structuredClone(DEFAULTS), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

let state = read();
const listeners = new Set();

export function getState() { return state; }

export function setState(patch) {
  state = typeof patch === 'function' ? { ...state, ...patch(state) } : { ...state, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota / private mode */ }
  listeners.forEach((fn) => fn(state));
  return state;
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function resetAll() {
  state = structuredClone(DEFAULTS);
  try { localStorage.removeItem(KEY); } catch {}
  listeners.forEach((fn) => fn(state));
}

export function exportJSON() {
  return JSON.stringify({ app: 'clashverse', version: 1, exported: new Date().toISOString(), state }, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  const incoming = parsed.state ?? parsed;
  if (typeof incoming !== 'object' || incoming === null) throw new Error('Not a ClashVerse export');
  setState({ ...structuredClone(DEFAULTS), ...incoming });
}
