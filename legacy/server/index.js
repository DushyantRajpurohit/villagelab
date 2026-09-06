/**
 * ClashVerse server — zero dependencies.
 *
 * Serves the static frontend from /web and a small JSON API from /api that
 * proxies (or mocks) the official Clash of Clans API.
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as coc from './coc-api.js';
import { TOWN_HALLS, MAX_TH, GRID, defaultBuilders } from '../data/town-halls.js';
import { BUILDINGS, buildingsAtTH } from '../data/buildings.js';
import { ALL_UNITS, CAMP_CAPACITY, SPELL_CAPACITY, unitsAtTH } from '../data/army.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const PORT = Number(process.env.PORT) || 8787;

await loadDotEnv();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(url, req, res);
    } else {
      await serveStatic(url, res);
    }
  } catch (err) {
    if (err instanceof coc.ApiError) {
      return json(res, err.status, { error: err.message, reason: err.reason, status: err.status });
    }
    if (err.status >= 400 && err.status < 500) {
      return json(res, err.status, { error: err.message });
    }
    console.error(`${req.method} ${url.pathname} ->`, err);
    json(res, 500, { error: err.message || 'Internal error' });
  }
});

// ----------------------------------------------------------------------- API

async function handleApi(url, req, res) {
  const seg = url.pathname.replace(/^\/api\//, '').split('/').filter(Boolean);
  const q = url.searchParams;

  // /api/health
  if (seg[0] === 'health') {
    return json(res, 200, { ok: true, ...coc.status(), townHalls: MAX_TH });
  }

  // /api/gamedata/th/:level — what exists at one Town Hall
  if (seg[0] === 'gamedata' && seg[1] === 'th') {
    const th = clampTH(seg[2]);
    return json(res, 200, {
      th,
      townHall: TOWN_HALLS[th],
      builders: defaultBuilders(th),
      buildings: buildingsAtTH(th),
      units: unitsAtTH(th),
      campCapacity: CAMP_CAPACITY[th],
      spellCapacity: SPELL_CAPACITY[th],
    });
  }

  // /api/gamedata — the whole curated dataset, cached hard by the client
  if (seg[0] === 'gamedata') {
    return json(res, 200, {
      maxTH: MAX_TH,
      grid: GRID,
      townHalls: TOWN_HALLS,
      buildings: BUILDINGS,
      units: ALL_UNITS,
      campCapacity: CAMP_CAPACITY,
      spellCapacity: SPELL_CAPACITY,
    }, { 'Cache-Control': 'public, max-age=3600' });
  }

  // /api/players/:tag
  if (seg[0] === 'players' && seg[1]) {
    return json(res, 200, await coc.getPlayer(seg[1]));
  }

  // /api/clans/:tag[/members|/currentwar|/warlog|/leaguegroup]
  if (seg[0] === 'clans' && seg[1]) {
    const tag = seg[1];
    switch (seg[2]) {
      case undefined: return json(res, 200, await coc.getClan(tag));
      case 'members': return json(res, 200, await coc.getClanMembers(tag));
      case 'currentwar':
        if (seg[3] === 'leaguegroup') return json(res, 200, await coc.getLeagueGroup(tag));
        return json(res, 200, await coc.getCurrentWar(tag));
      case 'warlog':
        return json(res, 200, await coc.getWarLog(tag, Number(q.get('limit')) || 20));
      default:
        return json(res, 404, { error: `Unknown clan sub-resource: ${seg[2]}` });
    }
  }

  // /api/search/clans?name=
  if (seg[0] === 'search' && seg[1] === 'clans') {
    const name = q.get('name');
    if (!name || name.length < 3) {
      return json(res, 400, { error: 'name must be at least 3 characters' });
    }
    return json(res, 200, await coc.searchClans({
      name,
      limit: Number(q.get('limit')) || 10,
      minMembers: q.get('minMembers') || undefined,
      warFrequency: q.get('warFrequency') || undefined,
    }));
  }

  json(res, 404, { error: `No such endpoint: ${url.pathname}` });
}

function clampTH(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > MAX_TH) {
    throw Object.assign(new Error(`Town Hall must be 1-${MAX_TH}`), { status: 400 });
  }
  return n;
}

// -------------------------------------------------------------------- static

async function serveStatic(url, res) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || !path.extname(rel)) rel = '/index.html'; // SPA fallback

  const file = path.join(WEB, path.normalize(rel));
  if (!file.startsWith(WEB)) return json(res, 403, { error: 'Forbidden' }); // path traversal

  try {
    const body = await fs.readFile(file);
    const type = MIME[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    throw err;
  }
}

function json(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

/** Minimal .env loader so we don't need dotenv. */
async function loadDotEnv() {
  try {
    const text = await fs.readFile(path.join(ROOT, '.env'), 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const val = m[2].replace(/^["']|["']$/g, '');
      if (process.env[m[1]] === undefined) process.env[m[1]] = val;
    }
    // coc-api read config at import time; refresh it from what we just loaded
    coc.config.token = process.env.COC_API_TOKEN?.trim() || coc.config.token;
    coc.config.base = process.env.COC_API_BASE?.trim() || coc.config.base;
    coc.config.forceMock = process.env.COC_FORCE_MOCK === '1';
  } catch {
    /* no .env — mock mode */
  }
}

server.listen(PORT, () => {
  const s = coc.status();
  console.log(`\n  ClashVerse  →  http://localhost:${PORT}`);
  console.log(`  data source: ${s.source}${s.reason ? `  (${s.reason})` : ''}\n`);
});
