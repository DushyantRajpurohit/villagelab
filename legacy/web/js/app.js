import { el, mount, icon, banner, $, toast } from './ui.js';
import * as api from './api.js';
import { getState, setState, subscribe, exportJSON, importJSON, resetAll } from './store.js';

import playerView from './modules/player.js';
import plannerView from './modules/planner.js';
import warView from './modules/warroom.js';
import baseView from './modules/base.js';

const ROUTES = [
  { id: 'player',  label: 'Player',      icon: 'player',  title: 'Player dashboard', render: playerView },
  { id: 'planner', label: 'Planner',     icon: 'planner', title: 'Upgrade planner',  render: plannerView },
  { id: 'war',     label: 'War room',    icon: 'war',     title: 'Clan war room',    render: warView },
  { id: 'base',    label: 'Base builder',icon: 'base',    title: 'Base builder',     render: baseView },
];

/** Shared context handed to every module. */
export const ctx = {
  data: null,      // curated game data from /api/gamedata
  health: null,    // { live, source, reason }
  navigate,
  refresh: () => render(currentRoute()),
};

function currentRoute() {
  const id = location.hash.replace(/^#\/?/, '').split('/')[0];
  return ROUTES.find((r) => r.id === id) || ROUTES[0];
}

function navigate(id) {
  if (location.hash === '#/' + id) render(currentRoute());
  else location.hash = '#/' + id;
}

function renderNav() {
  const active = currentRoute().id;
  const s = getState();
  const subs = {
    player: s.playerTag || null,
    planner: s.queue.length ? `${s.queue.length}` : null,
    war: s.clanTag || null,
    base: s.layouts.length ? `${s.layouts.length}` : null,
  };
  mount($('#nav'), ROUTES.map((r) => el('div.nav-item' + (r.id === active ? '.active' : ''), {
    onclick: () => navigate(r.id),
    role: 'link',
  }, [icon(r.icon), el('span', r.label), subs[r.id] ? el('span.nav-sub', subs[r.id]) : null])));
}

function renderFoot() {
  const h = ctx.health;
  mount($('#foot'), [
    el('div.row', { style: { marginBottom: '6px' } }, [
      el('span.tag' + (h?.live ? '.ok' : '.warn'), h?.live ? 'live API' : 'mock data'),
    ]),
    el('div', h?.live
      ? 'Connected to the Supercell API.'
      : 'Add COC_API_TOKEN to .env for live data.'),
  ]);
}

function renderTopbar() {
  const route = currentRoute();
  $('#topbar-title').textContent = route.title;
  mount($('#topbar-actions'), [
    el('button.btn.sm.ghost', {
      title: 'Export all local data (village, queue, layouts) as JSON',
      onclick: () => {
        const blob = new Blob([exportJSON()], { type: 'application/json' });
        const a = el('a', { href: URL.createObjectURL(blob), download: 'clashverse-backup.json' });
        document.body.appendChild(a); a.click(); a.remove();
      },
    }, [icon('download', 'nav-icon'), 'Export']),
    el('label.btn.sm.ghost', { title: 'Restore from a ClashVerse export' }, [
      icon('upload', 'nav-icon'), 'Import',
      el('input', {
        type: 'file', accept: 'application/json', style: { display: 'none' },
        onchange: async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try { importJSON(await file.text()); toast('Data imported', 'ok'); ctx.refresh(); }
          catch (err) { toast('Import failed: ' + err.message, 'bad'); }
          e.target.value = '';
        },
      }),
    ]),
    el('button.btn.sm.ghost.danger', {
      title: 'Clear all locally stored data',
      onclick: () => { if (confirm('Clear village, queue and saved layouts stored in this browser?')) { resetAll(); toast('Local data cleared'); ctx.refresh(); } },
    }, [icon('trash', 'nav-icon')]),
  ]);
}

async function render(route) {
  renderNav();
  renderTopbar();
  const view = $('#view');
  mount(view, el('div.row', { style: { padding: '40px', justifyContent: 'center' } }, el('span.spin')));
  try {
    const node = await route.render(ctx);
    mount(view, node);
  } catch (err) {
    console.error(err);
    mount(view, banner(`Failed to render ${route.label}: ${err.message}`, 'bad'));
  }
  view.scrollTop = 0;
}

async function boot() {
  try {
    const [data, health] = await Promise.all([api.gameData(), api.health()]);
    ctx.data = indexData(data);
    ctx.health = health;
  } catch (err) {
    mount($('#view'), banner(`Could not reach the ClashVerse server: ${err.message}. Is it running? (npm start)`, 'bad'));
    return;
  }
  renderFoot();
  window.addEventListener('hashchange', () => render(currentRoute()));
  subscribe(() => renderNav());
  if (!location.hash) location.hash = '#/player';
  render(currentRoute());
}

/** Add lookup maps once so modules don't rebuild them on every render. */
function indexData(data) {
  return {
    ...data,
    buildingsById: Object.fromEntries(data.buildings.map((b) => [b.id, b])),
    unitsById: Object.fromEntries(data.units.map((u) => [u.id, u])),
    /** Everything placeable/upgradable at a Town Hall. */
    buildingsAt: (th) => data.buildings.filter((b) => b.count[th] > 0),
    unitsAt: (th) => data.units.filter((u) => u.max[th] > 0),
  };
}

boot();
