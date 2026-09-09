/**
 * Supercell Clash of Clans API client.
 *
 * Only the ingestion worker calls this. User-facing routes read from Postgres —
 * a public page that proxied upstream 1:1 would be an amplification vector
 * against a rate limit we do not control.
 */
import { encodeTag } from './tags';
import { extractIp, rotateKey } from './rotate';

const BASE = process.env.COC_API_BASE?.trim() || 'https://api.clashofclans.com/v1';

/** Cached in module scope; survives warm invocations, re-fetched on cold ones. */
let token: string | null = null;

export class CocApiError extends Error {
  constructor(readonly status: number, message: string, readonly reason?: string) {
    super(message);
    this.name = 'CocApiError';
  }
  get isNotFound() { return this.status === 404; }
  get isInvalidIp() { return this.status === 403 && this.reason === 'accessDenied.invalidIp'; }
  get isRateLimited() { return this.status === 429; }
}

export const useMock = () =>
  process.env.COC_FORCE_MOCK === '1' ||
  (!process.env.COC_API_TOKEN && !process.env.COC_DEV_EMAIL);

async function call<T>(path: string, allowRotate = true): Promise<T> {
  token ??= process.env.COC_API_TOKEN?.trim() || null;

  const res = await fetch(BASE + path, {
    headers: { Authorization: `Bearer ${token ?? ''}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });

  if (res.ok) return res.json() as Promise<T>;

  const body = await res.json().catch(() => ({})) as { message?: string; reason?: string };
  const err = new CocApiError(res.status, body.message || `Supercell API ${res.status}`, body.reason);

  // The one case we can fix ourselves: our key isn't valid for this egress IP.
  if (err.isInvalidIp && allowRotate) {
    const ip = extractIp(body.message);
    if (!ip) throw err;
    const rotated = await rotateKey(ip);
    token = rotated.token;
    return call<T>(path, false); // retry once; never loop
  }

  throw err;
}

export interface RawPlayer {
  tag: string; name: string; townHallLevel: number; expLevel: number;
  trophies: number; bestTrophies: number; warStars: number; attackWins: number;
  donations: number; donationsReceived: number;
  /** Second village. Absent for accounts that have never unlocked it. */
  builderHallLevel?: number;
  builderBaseTrophies?: number;
  bestBuilderBaseTrophies?: number;
  league?: { name: string };
  clan?: { tag: string; name: string };
  role?: string;
  troops?: Array<{ name: string; level: number; village?: string }>;
  spells?: Array<{ name: string; level: number; village?: string }>;
  heroes?: Array<{ name: string; level: number; village?: string }>;
  /**
   * Hero equipment the account owns. Absent items were never obtained, which is
   * the only source we have for ownership — nothing else in the API or the
   * game's published tables says which epics a player has bought.
   */
  heroEquipment?: Array<{ name: string; level: number; village?: string }>;
}

export const getPlayer = (tag: string) => call<RawPlayer>(`/players/${encodeTag(tag)}`);
export const getClan = (tag: string) => call<Record<string, unknown>>(`/clans/${encodeTag(tag)}`);
export const getCurrentWar = (tag: string) => call<Record<string, unknown>>(`/clans/${encodeTag(tag)}/currentwar`);
export const getWarLog = (tag: string, limit = 20) =>
  call<Record<string, unknown>>(`/clans/${encodeTag(tag)}/warlog?limit=${limit}`);
export const searchClans = (name: string, limit = 10) =>
  call<Record<string, unknown>>(`/clans?name=${encodeURIComponent(name)}&limit=${limit}`);
