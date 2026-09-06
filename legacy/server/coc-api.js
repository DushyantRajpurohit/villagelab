/**
 * Supercell Clash of Clans API client.
 *
 * The official API requires a bearer token that is whitelisted to a specific
 * public IP, and it does not send CORS headers — so it cannot be called from a
 * browser. This module is the server-side half; the frontend only ever talks to
 * our own /api routes.
 *
 * With no token configured every method transparently falls back to the
 * deterministic mock generator, so the whole app is usable offline.
 */
import { TTLCache } from './cache.js';
import * as mock from './mock/generate.js';

const cache = new TTLCache(60_000);

export const config = {
  token: process.env.COC_API_TOKEN?.trim() || '',
  base: process.env.COC_API_BASE?.trim() || 'https://api.clashofclans.com/v1',
  forceMock: process.env.COC_FORCE_MOCK === '1',
};

export function isLive() {
  return Boolean(config.token) && !config.forceMock;
}

export function status() {
  return {
    live: isLive(),
    source: isLive() ? 'supercell' : 'mock',
    reason: config.forceMock
      ? 'COC_FORCE_MOCK=1'
      : config.token
        ? null
        : 'No COC_API_TOKEN set — serving deterministic mock data.',
    cached: cache.size,
  };
}

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || body?.reason || `Supercell API error ${status}`);
    this.status = status;
    this.reason = body?.reason;
  }
}

/** Tags contain only a known alphabet; O is a common typo for zero. */
export function normalizeTag(tag) {
  return mock.normalizeTag(tag);
}

const encTag = (tag) => encodeURIComponent(normalizeTag(tag));

async function request(path, { ttl = 60_000 } = {}) {
  const key = path;
  const hit = cache.get(key);
  if (hit) return hit;

  const res = await fetch(config.base + path, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(12_000),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 403 with reason accessDenied.invalidIp is the classic "wrong IP" case;
    // surface it verbatim so the UI can tell the user exactly what to fix.
    throw new ApiError(res.status, body);
  }
  return cache.set(key, body, ttl);
}

// --------------------------------------------------------------------- API --

export async function getPlayer(tag) {
  if (!isLive()) return mock.mockPlayer(tag);
  return request(`/players/${encTag(tag)}`, { ttl: 120_000 });
}

export async function getClan(tag) {
  if (!isLive()) return mock.mockClan(tag);
  return request(`/clans/${encTag(tag)}`, { ttl: 120_000 });
}

export async function getClanMembers(tag) {
  if (!isLive()) return { items: mock.mockClan(tag).memberList };
  return request(`/clans/${encTag(tag)}/members?limit=50`, { ttl: 120_000 });
}

export async function getCurrentWar(tag) {
  if (!isLive()) return mock.mockCurrentWar(tag);
  return request(`/clans/${encTag(tag)}/currentwar`, { ttl: 60_000 });
}

export async function getWarLog(tag, limit = 20) {
  if (!isLive()) return mock.mockWarLog(tag, limit);
  return request(`/clans/${encTag(tag)}/warlog?limit=${limit}`, { ttl: 300_000 });
}

export async function getLeagueGroup(tag) {
  if (!isLive()) return { state: 'notInWar', _mock: true };
  return request(`/clans/${encTag(tag)}/currentwar/leaguegroup`, { ttl: 300_000 });
}

export async function searchClans({ name, limit = 10, minMembers, warFrequency }) {
  if (!isLive()) return mock.mockClanSearch(name, limit);
  const q = new URLSearchParams({ name, limit: String(limit) });
  if (minMembers) q.set('minMembers', String(minMembers));
  if (warFrequency) q.set('warFrequency', warFrequency);
  return request(`/clans?${q}`, { ttl: 300_000 });
}

export function clearCache() {
  cache.clear();
}
