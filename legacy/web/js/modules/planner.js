import { el, mount, stat, bar, res, table, empty, banner, icon, toast, fmtInt, fmtDuration, fmtResource } from '../ui.js';
import { getState, setState } from '../store.js';

/* ==========================================================================
   Village state is stored as *level buckets* — { "14": 3, "15": 4 } means
   three structures at level 14 and four at 15. That scales to 325 walls as
   easily as to 2 Inferno Towers, and makes "upgrade the weakest one" trivial.
   ========================================================================== */

/** Buckets for a building at a Town Hall, defaulting to the previous TH ceiling. */
export function bucketsFor(state, b, th) {
  const count = b.count[th];
  const saved = state.village[b.id];
  if (saved && sumBuckets(saved) === count) return { ...saved };
  const baseline = String(Math.max(1, Math.min(b.max[th], th > 1 ? b.max[th - 1] || 1 : 1)));
  const fresh = { [baseline]: count };
  // preserve whatever the player already recorded, then top up / trim to count
  if (saved) return reconcile(saved, count, baseline);
  return fresh;
}

const sumBuckets = (bk) => Object.values(bk).reduce((a, n) => a + n, 0);

function reconcile(buckets, count, baseline) {
  const out = { ...buckets };
  let have = sumBuckets(out);
  if (have < count) out[baseline] = (out[baseline] || 0) + (count - have);
  while (have > count) {
    const lowest = Object.keys(out).map(Number).sort((a, b) => a - b)[0];
    const take = Math.min(out[lowest], have - count);
    out[lowest] -= take; have -= take;
    if (out[lowest] <= 0) delete out[lowest];
  }
  return out;
}

/** Lowest-level instance — the one an "upgrade next" action targets. */
function weakest(buckets) {
  const levels = Object.keys(buckets).map(Number).filter((l) => buckets[l] > 0).sort((a, b) => a - b);
  return levels[0] ?? null;
}

/* ------------------------------------------------------------------ costing */

export function buildingRemaining(b, buckets, th) {
  const cap = b.max[th];
  let cost = 0, hours = 0, est = false, pending = 0;
  for (const [lvlStr, n] of Object.entries(buckets)) {
    const lvl = Number(lvlStr);
    for (let l = lvl + 1; l <= cap; l++) {
      const step = b.levels[l];
      if (!step) continue;
      cost += step.cost * n; hours += step.hours * n; est ||= step.est;
    }
    if (lvl < cap) pending += n;
  }
  return { cost, hours, est, pending, cap };
}

export function unitRemaining(u, level, th) {
  const cap = u.max[th];
  let cost = 0, hours = 0, est = false;
  for (let l = level + 1; l <= cap; l++) {
    const step = u.levels[l];
    if (!step) continue;
    cost += step.cost; hours += step.hours; est ||= step.est;
  }
  return { cost, hours, est, cap, pending: level < cap ? 1 : 0 };
}

/* ---------------------------------------------------------------- scheduler */

/**
 * Greedy multi-lane schedule.
 *
 * Buildings compete for N builders; laboratory research is one sequential lane;
 * hero upgrades are their own lane (the Hero Hall does not consume a builder in
 * current versions of the game). Items are placed in queue order into whichever
 * lane of the right type frees up first.
 *
 * @returns {{items: Array, finishHours: number, lanes: Object}}
 */
export function schedule(queue, builders) {
  const lanes = {
    builder: Array.from({ length: Math.max(1, builders) }, () => 0),
    lab: [0],
    hero: [0],
  };

  const items = queue.map((q) => {
    const laneType = q.lane || 'builder';
    const pool = lanes[laneType] || lanes.builder;
    let idx = 0;
    for (let i = 1; i < pool.length; i++) if (pool[i] < pool[idx]) idx = i;
    const start = pool[idx];
    const end = start + (q.hours || 0);
    pool[idx] = end;
    return { ...q, laneType, laneIndex: idx, start, end };
  });

  const finishHours = Math.max(0, ...Object.values(lanes).flat());
  return { items, finishHours, lanes };
}

/* ------------------------------------------------------------------- view */

const RESOURCES = ['gold', 'elixir', 'dark'];

export default async function plannerView(ctx) {
  const root = el('div');

  function draw() {
    const s = getState();
    const th = s.th;
    const data = ctx.data;

    const buildings = data.buildingsAt(th);
    const units = data.unitsAt(th);

    // --- current state -> rows -------------------------------------------
    const buildingRows = buildings.map((b) => {
      const buckets = bucketsFor(s, b, th);
      const r = buildingRemaining(b, buckets, th);
      const w = weakest(buckets);
      return { type: 'building', ref: b, id: b.id, name: b.name, category: b.category,
        resource: b.resource, buckets, weakest: w, ...r,
        next: w != null && w < r.cap ? b.levels[w + 1] : null };
    });

    const unitRows = units.map((u) => {
      const level = s.lab[u.id] ?? 0;
      const r = unitRemaining(u, level, th);
      return { type: 'unit', ref: u, id: u.id, name: u.name, category: u.kind,
        resource: u.resource, level, ...r,
        next: level < r.cap ? u.levels[level + 1] : null };
    });

    const allRows = [...buildingRows, ...unitRows];

    // --- totals -----------------------------------------------------------
    const toMax = allRows.reduce((a, r) => {
      a[r.resource] = (a[r.resource] || 0) + r.cost;
      a.hours += r.hours; a.est ||= r.est; a.pending += r.pending;
      return a;
    }, { hours: 0, est: false, pending: 0 });

    const sched = schedule(s.queue, s.builders);
    const queueTotals = s.queue.reduce((a, q) => {
      a[q.resource] = (a[q.resource] || 0) + q.cost;
      a.est ||= q.est;
      return a;
    }, { est: false });

    mount(root, [
      el('div.view-head', [
        el('div', [
          el('h1', 'Upgrade planner'),
          el('p', 'Record what your village actually looks like, queue what you want next, and see the real completion date across your builders, laboratory and hero altars.'),
        ]),
      ]),

      setupPanel(s, ctx),

      el('div.grid.g4', [
        tile(stat(`Everything left at TH${th}`, String(toMax.pending), 'upgrades outstanding')),
        tile(stat('Gold needed', res(toMax.gold || 0, 'gold', toMax.est))),
        tile(stat('Elixir needed', res(toMax.elixir || 0, 'elixir', toMax.est))),
        tile(stat('Dark elixir needed', res(toMax.dark || 0, 'dark', toMax.est))),
      ]),

      queuePanel(s, sched, queueTotals, draw),

      availablePanel(allRows, s, draw),

      villagePanel(buildingRows, s, th, draw),
    ]);
  }

  draw();
  return root;
}

function tile(inner) { return el('section.panel', el('div.panel-body', inner)); }

/* --------------------------------------------------------------- setup bar */

function setupPanel(s, ctx) {
  const thSel = el('select', { onchange: (e) => setState({ th: Number(e.target.value) }) },
    Array.from({ length: ctx.data.maxTH }, (_, i) => i + 1).map((n) =>
      el('option', { value: n, selected: n === s.th || null }, 'Town Hall ' + n)));

  const builders = el('input', {
    type: 'number', min: '1', max: '6', value: String(s.builders),
    style: { width: '64px' },
    onchange: (e) => setState({ builders: Math.max(1, Math.min(6, Number(e.target.value) || 1)) }),
  });

  const resInputs = RESOURCES.map((k) => el('label.field', [
    k === 'dark' ? 'Dark elixir on hand' : `${k[0].toUpperCase() + k.slice(1)} on hand`,
    el('input.mono', {
      type: 'number', min: '0', value: String(s.resources[k] || 0), style: { width: '130px' },
      onchange: (e) => setState({ resources: { ...s.resources, [k]: Math.max(0, Number(e.target.value) || 0) } }),
    }),
  ]));

  return el('section.panel', el('div.panel-body', el('div.row.wrap', { style: { gap: '18px', alignItems: 'flex-end' } }, [
    el('label.field', ['Town Hall', thSel]),
    el('label.field', ['Builders', builders]),
    ...resInputs,
    el('div.spacer'),
    el('button.btn.ghost', {
      title: 'Reset recorded building levels to the previous Town Hall ceiling',
      onclick: () => { if (confirm('Reset all recorded building levels for this Town Hall?')) { setState({ village: {} }); toast('Village levels reset'); } },
    }, [icon('refresh', 'nav-icon'), 'Reset village']),
  ])));
}

/* ------------------------------------------------------------------- queue */

function queuePanel(s, sched, totals, redraw) {
  const remove = (uid) => setState({ queue: s.queue.filter((q) => q.uid !== uid) });
  const move = (uid, dir) => {
    const i = s.queue.findIndex((q) => q.uid === uid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= s.queue.length) return;
    const next = [...s.queue];
    [next[i], next[j]] = [next[j], next[i]];
    setState({ queue: next });
  };

  const deficits = RESOURCES
    .map((k) => ({ k, need: totals[k] || 0, have: s.resources[k] || 0 }))
    .filter((d) => d.need > d.have);

  const body = s.queue.length
    ? el('div', [
        el('div.grid.g4', { style: { marginBottom: '14px' } }, [
          stat('Finishes in', fmtDuration(sched.finishHours), `${s.builders} builder${s.builders === 1 ? '' : 's'} + lab + heroes`),
          stat('Gold', res(totals.gold || 0, 'gold', totals.est)),
          stat('Elixir', res(totals.elixir || 0, 'elixir', totals.est)),
          stat('Dark elixir', res(totals.dark || 0, 'dark', totals.est)),
        ]),
        deficits.length ? banner(el('div', [
          el('b', 'Short on resources: '),
          deficits.map((d, i) => el('span', [
            i ? ', ' : '',
            `${fmtResource(d.need - d.have)} more ${d.k === 'dark' ? 'dark elixir' : d.k}`,
          ])),
        ]), 'warn') : banner('You have enough banked for this whole queue.', ''),
        el('div', { style: { marginTop: '14px' } }, table([
          { key: 'order', label: '#', num: true, sortable: false, render: (_, i) => el('span.num', { style: { color: 'var(--faint)' } }, String(i + 1)) },
          { key: 'name', label: 'Upgrade', sortable: false, render: (q) => el('div.row', [
            el('span', q.name),
            el('span.tag', `${q.from} → ${q.to}`),
            el('span.tag' + laneTone(q.laneType), laneLabel(q.laneType)),
          ]) },
          { key: 'cost', label: 'Cost', num: true, sortable: false, render: (q) => res(q.cost, q.resource, q.est) },
          { key: 'hours', label: 'Duration', num: true, sortable: false, render: (q) => el('span.num', fmtDuration(q.hours)) },
          { key: 'end', label: 'Done', num: true, sortable: false, render: (q) => el('span.num', { style: { color: 'var(--muted)' } }, fmtDuration(q.end)) },
          { key: 'act', label: '', sortable: false, render: (q) => el('div.row', { style: { justifyContent: 'flex-end' } }, [
            el('button.btn.sm.ghost', { title: 'Move earlier', onclick: () => move(q.uid, -1) }, '↑'),
            el('button.btn.sm.ghost', { title: 'Move later', onclick: () => move(q.uid, 1) }, '↓'),
            el('button.btn.sm.ghost.danger', { title: 'Remove', onclick: () => remove(q.uid) }, icon('x', 'nav-icon')),
          ]) },
        ], sched.items, {})),
        el('div', { style: { marginTop: '14px' } }, laneChart(sched, s.builders)),
      ])
    : empty('Queue is empty', 'Add upgrades from the list below and the planner will schedule them across your builders.');

  return el('section.panel', [
    el('div.panel-head', [
      el('h2', 'Build queue'),
      el('div.spacer'),
      s.queue.length ? el('button.btn.sm.ghost.danger', {
        onclick: () => { setState({ queue: [] }); toast('Queue cleared'); },
      }, 'Clear all') : null,
    ]),
    el('div.panel-body', body),
  ]);
}

/** Horizontal timeline: one row per builder / lab / hero lane. */
function laneChart(sched, builders) {
  const span = Math.max(1, sched.finishHours);
  const lanes = [
    ...Array.from({ length: builders }, (_, i) => ({ type: 'builder', index: i, label: `Builder ${i + 1}` })),
    { type: 'lab', index: 0, label: 'Laboratory' },
    { type: 'hero', index: 0, label: 'Hero altar' },
  ].filter((l) => sched.items.some((it) => it.laneType === l.type && it.laneIndex === l.index));

  if (!lanes.length) return null;

  return el('div', [
    el('h3', { style: { marginBottom: '8px' } }, 'Timeline'),
    el('div.grid', { style: { gap: '4px' } }, lanes.map((lane) => el('div.row', { style: { gap: '10px' } }, [
      el('div', { style: { width: '92px', fontSize: '12px', color: 'var(--muted)', flexShrink: 0 } }, lane.label),
      el('div', { style: { position: 'relative', height: '20px', flex: 1, background: 'var(--panel-2)', borderRadius: '4px', overflow: 'hidden' } },
        sched.items.filter((it) => it.laneType === lane.type && it.laneIndex === lane.index).map((it) =>
          el('div', {
            title: `${it.name} ${it.from}→${it.to} · ${fmtDuration(it.hours)}`,
            style: {
              position: 'absolute', top: '2px', bottom: '2px',
              left: (it.start / span) * 100 + '%',
              width: Math.max(0.6, (it.hours / span) * 100) + '%',
              background: `var(--${it.resource === 'gold' ? 'gold' : it.resource === 'dark' ? 'dark' : 'elixir'})`,
              opacity: .8, borderRadius: '3px',
            },
          }))),
    ]))),
    el('div.row', { style: { marginTop: '6px', fontSize: '11px', color: 'var(--faint)', justifyContent: 'space-between' } }, [
      el('span', '0'), el('span', fmtDuration(sched.finishHours)),
    ]),
  ]);
}

const laneLabel = (l) => ({ builder: 'builder', lab: 'lab', hero: 'hero' }[l] || l);
const laneTone = (l) => ({ lab: '.info', hero: '.gold' }[l] || '');

/* --------------------------------------------------------------- available */

const CATEGORIES = [
  { id: 'all', label: 'Everything' },
  { id: 'defense', label: 'Defenses' },
  { id: 'trap', label: 'Traps' },
  { id: 'resource', label: 'Resources' },
  { id: 'army', label: 'Army buildings' },
  { id: 'wall', label: 'Walls' },
  { id: 'hero', label: 'Heroes' },
  { id: 'troop', label: 'Troops' },
  { id: 'spell', label: 'Spells' },
  { id: 'siege', label: 'Sieges' },
  { id: 'pet', label: 'Pets' },
];

let activeCat = 'all';

function availablePanel(rows, s, redraw) {
  const upgradable = rows.filter((r) => r.next);
  const shown = activeCat === 'all' ? upgradable : upgradable.filter((r) => r.category === activeCat);

  const laneOf = (r) => (r.type === 'unit' ? (r.category === 'hero' ? 'hero' : r.category === 'pet' ? 'hero' : 'lab') : 'builder');

  const add = (r) => {
    const from = r.type === 'building' ? r.weakest : r.level;
    const to = from + 1;
    const step = r.next;
    const entry = {
      uid: `${r.id}-${to}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      kind: r.type, id: r.id, name: r.name, from, to,
      cost: step.cost, hours: step.hours, est: step.est,
      resource: r.resource, lane: laneOf(r),
    };
    setState({ queue: [...s.queue, entry] });
    toast(`Queued ${r.name} ${from} → ${to}`);
  };

  const cats = el('div.row.wrap', { style: { gap: '6px' } }, CATEGORIES
    .filter((c) => c.id === 'all' || upgradable.some((r) => r.category === c.id))
    .map((c) => el('button.btn.sm' + (c.id === activeCat ? '.primary' : '.ghost'), {
      onclick: () => { activeCat = c.id; redraw(); },
    }, c.label)));

  return el('section.panel', [
    el('div.panel-head', [el('h2', 'Available upgrades'), el('div.spacer'),
      el('span.tag', `${upgradable.length} available`)]),
    el('div.panel-body', cats),
    el('div.panel-body.tight', table([
      { key: 'name', label: 'Target', render: (r) => el('div.row', [
        el('span', r.name),
        el('span.tag', r.category),
        r.type === 'building' && r.ref.count[s.th] > 1 ? el('span.tag', { title: 'Structures of this type still below the cap' }, `${r.pending}/${r.ref.count[s.th]} left`) : null,
      ]) },
      { key: 'from', label: 'Next', num: true, sort: (r) => (r.type === 'building' ? r.weakest : r.level),
        render: (r) => el('span.num', `${r.type === 'building' ? r.weakest : r.level} → ${(r.type === 'building' ? r.weakest : r.level) + 1}`) },
      { key: 'cap', label: 'Cap', num: true, render: (r) => el('span.num', { style: { color: 'var(--muted)' } }, String(r.cap)) },
      { key: 'nextCost', label: 'Cost', num: true, sort: (r) => r.next.cost, render: (r) => res(r.next.cost, r.resource, r.next.est) },
      { key: 'nextTime', label: 'Time', num: true, sort: (r) => r.next.hours, render: (r) => el('span.num', fmtDuration(r.next.hours)) },
      { key: 'cost', label: 'All to cap', num: true, render: (r) => res(r.cost, r.resource, r.est) },
      { key: 'add', label: '', sortable: false, render: (r) => el('div.row', { style: { justifyContent: 'flex-end' } },
        el('button.btn.sm', { onclick: () => add(r) }, [icon('plus', 'nav-icon'), 'Queue'])) },
    ], shown, { sortKey: 'nextCost', sortDir: 1, emptyMsg: 'Everything in this category is already at the Town Hall cap.' })),
  ]);
}

/* ---------------------------------------------------------------- village */

function villagePanel(buildingRows, s, th, redraw) {
  const setBuckets = (id, buckets) => setState({ village: { ...s.village, [id]: buckets } });

  const rows = buildingRows.filter((r) => r.ref.count[th] > 0);

  return el('section.panel', [
    el('div.panel-head', [
      el('h2', 'Your village'),
      el('div.spacer'),
      el('span.tag', 'stored in this browser'),
    ]),
    el('div.panel-body', banner('Levels default to the previous Town Hall ceiling. Correct them here and every cost above updates.')),
    el('div.panel-body.tight', table([
      { key: 'name', label: 'Building', render: (r) => el('div.row', [el('span', r.name), el('span.tag', r.category)]) },
      { key: 'count', label: 'Count', num: true, sort: (r) => r.ref.count[th], render: (r) => el('span.num', String(r.ref.count[th])) },
      { key: 'levels', label: 'Levels', sortable: false, render: (r) => bucketEditor(r, th, (bk) => { setBuckets(r.id, bk); redraw(); }) },
      { key: 'pending', label: 'Left', num: true, render: (r) => el('span.num', { style: { color: r.pending ? 'var(--warn)' : 'var(--ok)' } }, r.pending ? String(r.pending) : 'max') },
      { key: 'cost', label: 'To cap', num: true, render: (r) => res(r.cost, r.resource, r.est) },
    ], rows, { sortKey: 'cost' })),
  ]);
}

/**
 * Compact level-bucket editor: one number input per level that currently has
 * structures, plus a control to move structures to a level. Totals are clamped
 * to the building's count at this Town Hall.
 */
function bucketEditor(row, th, onChange) {
  const cap = row.ref.max[th];
  const count = row.ref.count[th];
  const buckets = row.buckets;
  const levels = Object.keys(buckets).map(Number).filter((l) => buckets[l] > 0).sort((a, b) => a - b);

  const wrap = el('div.row.wrap', { style: { gap: '6px' } });

  for (const lvl of levels) {
    wrap.append(el('div.row', { style: { gap: '3px', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: '5px', padding: '1px 5px' } }, [
      el('span', { style: { fontSize: '11px', color: 'var(--muted)' } }, 'L' + lvl),
      el('input.mono', {
        type: 'number', min: '0', max: String(count), value: String(buckets[lvl]),
        style: { width: '46px', padding: '2px 5px', fontSize: '12px' },
        onchange: (e) => {
          const n = Math.max(0, Math.min(count, Number(e.target.value) || 0));
          const next = { ...buckets, [lvl]: n };
          if (!n) delete next[lvl];
          onChange(rebalance(next, count, cap));
        },
      }),
      lvl < cap ? el('button.btn.sm.ghost', {
        title: `Move one structure from level ${lvl} to ${lvl + 1}`,
        style: { padding: '1px 5px' },
        onclick: () => {
          const next = { ...buckets };
          next[lvl] -= 1;
          if (!next[lvl]) delete next[lvl];
          next[lvl + 1] = (next[lvl + 1] || 0) + 1;
          onChange(next);
        },
      }, '+') : null,
    ]));
  }

  wrap.append(el('button.btn.sm.ghost', {
    title: `Set every ${row.name} to the TH${th} cap (level ${cap})`,
    onclick: () => onChange({ [cap]: count }),
  }, 'max'));

  return wrap;
}

/** Keep bucket totals equal to the structure count, filling at the lowest level. */
function rebalance(buckets, count, cap) {
  const out = { ...buckets };
  let have = Object.values(out).reduce((a, n) => a + n, 0);
  if (have < count) {
    const lowest = Object.keys(out).map(Number).sort((a, b) => a - b)[0] ?? 1;
    out[lowest] = (out[lowest] || 0) + (count - have);
  } else if (have > count) {
    const highest = Object.keys(out).map(Number).sort((a, b) => b - a);
    for (const l of highest) {
      if (have <= count) break;
      const take = Math.min(out[l], have - count);
      out[l] -= take; have -= take;
      if (!out[l]) delete out[l];
    }
  }
  return out;
}
