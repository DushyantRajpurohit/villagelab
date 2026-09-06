/** Client for our own /api. Game data is fetched once and memoised. */

let gameDataPromise = null;

async function get(path) {
  const res = await fetch('/api' + path, { headers: { Accept: 'application/json' } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.reason = body.reason;
    throw err;
  }
  return body;
}

export const health = () => get('/health');

export function gameData() {
  gameDataPromise ??= get('/gamedata');
  return gameDataPromise;
}

export const player = (tag) => get('/players/' + encodeURIComponent(tag));
export const clan = (tag) => get('/clans/' + encodeURIComponent(tag));
export const clanMembers = (tag) => get('/clans/' + encodeURIComponent(tag) + '/members');
export const currentWar = (tag) => get('/clans/' + encodeURIComponent(tag) + '/currentwar');
export const warLog = (tag, limit = 20) => get(`/clans/${encodeURIComponent(tag)}/warlog?limit=${limit}`);
export const leagueGroup = (tag) => get('/clans/' + encodeURIComponent(tag) + '/currentwar/leaguegroup');
export const searchClans = (name, limit = 10) => get(`/search/clans?name=${encodeURIComponent(name)}&limit=${limit}`);

/** Normalise a player/clan tag the same way the server does. */
export function normalizeTag(tag) {
  const t = String(tag).toUpperCase().replace(/^#/, '').replace(/O/g, '0');
  return '#' + t.replace(/[^0289PYLQGRJCUV]/g, '');
}
