import { el, mount, panel, stat, bar, res, table, empty, banner, icon, toast, fmtInt, fmtDuration, fmtResource } from '../ui.js';
import * as api from '../api.js';
import { getState, setState } from '../store.js';

/** Loose name match between API unit names and our dataset. */
const key = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Merge a player's API levels with the curated max-per-TH data.
 * Returns one row per unit available at the player's Town Hall.
 */
export function analyseUnits(data, player) {
  const th = player.townHallLevel;
  const apiLevels = new Map();
  for (const list of [player.heroes, player.troops, player.spells]) {
    for (const u of list || []) {
      if (u.village && u.village !== 'home') continue; // skip Builder Base
      apiLevels.set(key(u.name), u.level);
    }
  }

  return data.unitsAt(th).map((u) => {
    const maxHere = u.max[th];
    const prevMax = th > 1 ? u.max[th - 1] : 0;
    const level = apiLevels.get(key(u.name)) ?? 0;

    let cost = 0, hours = 0, est = false;
    for (let l = level + 1; l <= maxHere; l++) {
      const step = u.levels[l];
      if (!step) continue;
      cost += step.cost; hours += step.hours; est ||= step.est;
    }

    return {
      unit: u, id: u.id, name: u.name, kind: u.kind, resource: u.resource,
      level, maxHere, prevMax,
      pct: maxHere ? (level / maxHere) * 100 : 0,
      /** Behind the *previous* Town Hall's ceiling — the usual definition of rushed. */
      rushed: prevMax > 0 && level < prevMax,
      remainingCost: cost, remainingHours: hours, est,
      found: apiLevels.has(key(u.name)),
    };
  });
}

const KIND_LABEL = { hero: 'Heroes', troop: 'Troops', spell: 'Spells', siege: 'Siege machines', pet: 'Pets' };
const KIND_ORDER = ['hero', 'pet', 'troop', 'spell', 'siege'];

export default async function playerView(ctx) {
  const root = el('div');
  const s = getState();
  let tag = s.playerTag;

  const input = el('input.mono', {
    placeholder: '#2PP0JCVL9', value: tag, spellcheck: 'false',
    onkeydown: (e) => { if (e.key === 'Enter') go(); },
    style: { width: '180px' },
  });

  const body = el('div');

  const head = el('div.view-head', [
    el('div', [
      el('h1', 'Player dashboard'),
      el('p', 'Look up any player tag to see how close their army is to the ceiling for their Town Hall, what it costs to close the gap, and whether the account is rushed.'),
    ]),
    el('div.spacer'),
    el('div.row', [
      input,
      el('button.btn.primary', { onclick: go }, [icon('search', 'nav-icon'), 'Look up']),
    ]),
  ]);

  mount(root, [head, body]);

  async function go() {
    const t = api.normalizeTag(input.value.trim());
    if (t.length < 4) { toast('Enter a valid player tag', 'bad'); return; }
    input.value = t;
    setState({ playerTag: t });
    mount(body, el('div.row', { style: { padding: '40px', justifyContent: 'center' } }, el('span.spin')));
    try {
      const p = await api.player(t);
      mount(body, renderPlayer(ctx, p));
    } catch (err) {
      mount(body, renderError(err, t));
    }
  }

  if (tag) await go();
  else mount(body, empty('No player loaded', 'Enter a player tag above. Tags look like #2PP0JCVL9 and are found on the in-game profile screen.'));

  return root;
}

function renderError(err, tag) {
  if (err.status === 404) {
    return banner(`No player found with tag ${tag}. Check the tag on the in-game profile screen.`, 'warn');
  }
  if (err.status === 403) {
    return banner(el('div', [
      el('b', 'The Supercell API rejected the request. '),
      'This is almost always an IP whitelist problem: the token in .env must be created for the public IP this server runs on. ',
      err.reason ? el('code', ` (${err.reason})`) : null,
    ]), 'bad');
  }
  return banner(`Lookup failed: ${err.message}`, 'bad');
}

function renderPlayer(ctx, p) {
  const rows = analyseUnits(ctx.data, p);
  const th = p.townHallLevel;

  const totals = rows.reduce((a, r) => {
    a[r.resource] = (a[r.resource] || 0) + r.remainingCost;
    a.hours += r.remainingHours;
    a.est ||= r.est;
    return a;
  }, { hours: 0, est: false });

  const rushed = rows.filter((r) => r.rushed);
  const maxed = rows.filter((r) => r.level >= r.maxHere && r.maxHere > 0);
  const overall = rows.length
    ? (rows.reduce((a, r) => a + Math.min(1, r.level / Math.max(1, r.maxHere)), 0) / rows.length) * 100
    : 0;

  return el('div.grid', { style: { gap: '16px' } }, [
    p._mock ? banner(el('div', [
      el('b', 'Mock data. '),
      'This profile is generated deterministically from the tag so the UI is usable offline. Add a token to .env for real data.',
    ]), 'warn') : null,

    identityCard(p, overall),

    el('div.grid.g4', [
      card(stat('Army progress', overall.toFixed(0) + '%', `${maxed.length} of ${rows.length} maxed for TH${th}`), overall, toneFor(overall)),
      card(stat('Rushed units', String(rushed.length), rushed.length ? 'below the TH' + (th - 1) + ' ceiling' : 'nothing left behind', rushed.length ? 'bad' : 'ok')),
      card(stat('Lab time left', fmtDuration(totals.hours), 'one laboratory, sequential')),
      card(stat('War stars', fmtInt(p.warStars), `${fmtInt(p.attackWins)} attack wins`)),
    ]),

    el('section.panel', [
      el('div.panel-head', [
        el('h2', `Cost to max the army at TH${th}`),
        el('div.spacer'),
        totals.est ? el('span.tag', '≈ includes interpolated values') : null,
      ]),
      el('div.panel-body', [
        el('div.grid.g3', [
          ['elixir', 'Elixir'], ['dark', 'Dark elixir'], ['gold', 'Gold'],
        ].filter(([k]) => totals[k] > 0).map(([k, label]) => costTile(label, totals[k], k, totals.est))),
        el('p', { style: { margin: '12px 0 0', color: 'var(--muted)', fontSize: '12px' } },
          'Laboratory, hero and pet upgrades only — building costs live in the planner, which tracks levels the API does not expose.'),
      ]),
    ]),

    rushed.length ? el('section.panel', [
      el('div.panel-head', [el('h2', 'Rushed — behind the previous Town Hall'), el('div.spacer'),
        el('span.tag.bad', `${rushed.length} unit${rushed.length === 1 ? '' : 's'}`)]),
      el('div.panel-body.tight', table([
        { key: 'name', label: 'Unit', render: (r) => el('div.row', [el('span', r.name), el('span.tag', KIND_LABEL[r.kind]?.replace(/s$/, '') || r.kind)]) },
        { key: 'level', label: 'Level', num: true, render: (r) => el('span.num', String(r.level)) },
        { key: 'prevMax', label: `TH${th - 1} max`, num: true, render: (r) => el('span.num', { style: { color: 'var(--bad)' } }, String(r.prevMax)) },
        { key: 'maxHere', label: `TH${th} max`, num: true, render: (r) => el('span.num', { style: { color: 'var(--muted)' } }, String(r.maxHere)) },
        { key: 'remainingCost', label: 'To max', num: true, render: (r) => res(r.remainingCost, r.resource, r.est) },
      ], rushed, { sortKey: 'remainingCost' })),
    ]) : null,

    ...KIND_ORDER.filter((k) => rows.some((r) => r.kind === k)).map((kind) => unitSection(kind, rows.filter((r) => r.kind === kind), th)),

    el('div.row', [
      el('button.btn', {
        onclick: () => {
          const lab = Object.fromEntries(rows.filter((r) => r.found).map((r) => [r.id, r.level]));
          setState({ lab, th, playerTag: p.tag });
          toast(`Imported ${Object.keys(lab).length} unit levels into the planner`, 'ok');
        },
      }, [icon('planner', 'nav-icon'), 'Send levels to planner']),
      p.clan?.tag ? el('button.btn', {
        onclick: () => { setState({ clanTag: p.clan.tag }); ctx.navigate('war'); },
      }, [icon('war', 'nav-icon'), `Open ${p.clan.name} in war room`]) : null,
    ]),
  ]);
}

function identityCard(p, overall) {
  return el('section.panel', el('div.panel-body', el('div.row.wrap', { style: { gap: '20px' } }, [
    el('div', [
      el('div.row', [
        el('h1', p.name),
        el('span.tag.gold', 'TH' + p.townHallLevel),
        p.role ? el('span.tag', prettyRole(p.role)) : null,
      ]),
      el('div.row', { style: { marginTop: '4px', color: 'var(--muted)' } }, [
        el('code', p.tag),
        p.clan ? el('span', '· ' + p.clan.name) : el('span', '· no clan'),
        el('span', '· XP ' + p.expLevel),
      ]),
    ]),
    el('div.spacer'),
    el('div.row', { style: { gap: '28px' } }, [
      stat('Trophies', fmtInt(p.trophies), p.league?.name || 'Unranked'),
      stat('Best', fmtInt(p.bestTrophies)),
      stat('Donated', fmtInt(p.donations), `${fmtInt(p.donationsReceived)} received`),
      el('div', { style: { minWidth: '140px' } }, [
        stat('Maxed for TH', overall.toFixed(0) + '%'),
        el('div', { style: { marginTop: '6px' } }, bar(overall, toneFor(overall))),
      ]),
    ]),
  ])));
}

function card(inner, pct, tone) {
  return el('section.panel', el('div.panel-body', [
    inner,
    pct != null ? el('div', { style: { marginTop: '10px' } }, bar(pct, tone)) : null,
  ]));
}

function costTile(label, amount, kind, est) {
  return el('div', [
    el('div.stat-label', label),
    el('div.stat-value', res(amount, kind, est && amount > 0)),
  ]);
}

function unitSection(kind, rows, th) {
  const done = rows.filter((r) => r.level >= r.maxHere).length;
  return el('section.panel', [
    el('div.panel-head', [
      el('h2', KIND_LABEL[kind] || kind),
      el('div.spacer'),
      el('span.tag' + (done === rows.length ? '.ok' : ''), `${done}/${rows.length} maxed`),
    ]),
    el('div.panel-body.tight', table([
      { key: 'name', label: 'Unit', render: (r) => el('div.row', [
        el('span', { style: r.level >= r.maxHere ? { color: 'var(--ok)' } : null }, r.name),
        r.rushed ? el('span.tag.bad', 'rushed') : null,
        !r.found ? el('span.tag', { title: 'Not present on the account yet' }, 'not unlocked') : null,
      ]) },
      { key: 'level', label: 'Level', num: true, render: (r) => el('span.num', `${r.level} / ${r.maxHere}`) },
      { key: 'pct', label: 'Progress', sort: (r) => r.pct, render: (r) => el('div', { style: { minWidth: '90px' } }, bar(r.pct, toneFor(r.pct))) },
      { key: 'remainingCost', label: 'To max', num: true, render: (r) => (r.remainingCost ? res(r.remainingCost, r.resource, r.est) : el('span', { style: { color: 'var(--faint)' } }, '—')) },
      { key: 'remainingHours', label: 'Lab time', num: true, render: (r) => el('span.num', { style: { color: 'var(--muted)' } }, r.remainingHours ? fmtDuration(r.remainingHours) : '—') },
    ], rows, { sortKey: 'pct', sortDir: 1 })),
  ]);
}

const toneFor = (pct) => (pct >= 99 ? 'ok' : pct >= 60 ? '' : pct >= 30 ? 'warn' : 'bad');
const prettyRole = (r) => ({ member: 'Member', admin: 'Elder', coLeader: 'Co-leader', leader: 'Leader' }[r] || r);
