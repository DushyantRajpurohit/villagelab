import { el, mount, empty, banner, icon, toast, stat } from '../ui.js';
import { getState, setState } from '../store.js';

/* ==========================================================================
   44x44 grid editor.

   Layout state is a flat list of { id, x, y } where x,y is the top-left tile of
   the structure. Collision and count limits are enforced on placement, so a
   saved layout is always buildable for its Town Hall.
   ========================================================================== */

const GRID = 44;

const CATEGORY_COLOR = {
  defense:  { fill: '#4a2320', stroke: '#c0574d', text: '#ffb3ab' },
  trap:     { fill: '#4a3410', stroke: '#c99b2e', text: '#ffd98a' },
  resource: { fill: '#3f3a14', stroke: '#c0a83a', text: '#f0dc8a' },
  army:     { fill: '#3a2447', stroke: '#a76bd0', text: '#e0b3ff' },
  wall:     { fill: '#33383f', stroke: '#7b8797', text: '#c3ccd8' },
  hero:     { fill: '#3d3416', stroke: '#e0b429', text: '#ffdf8a' },
  other:    { fill: '#1d3446', stroke: '#4a8ec0', text: '#9fd4ff' },
  townhall: { fill: '#4a3a12', stroke: '#f0b429', text: '#ffe6a8' },
};

// Initials only — digits would turn "Town Hall 14" into "TH1".
const abbrev = (name) => name.split(/[\s.-]+/).map((w) => w[0]).filter((c) => c && /[a-z]/i.test(c)).join('').slice(0, 3).toUpperCase();

export default async function baseView(ctx) {
  const root = el('div');
  const s = getState();
  const th = s.th;

  /** Palette entries: real buildings at this TH plus the Town Hall itself. */
  const palette = [
    { id: '__townhall', name: `Town Hall ${th}`, category: 'townhall', size: [4, 4], limit: 1 },
    ...ctx.data.buildingsAt(th).map((b) => ({ id: b.id, name: b.name, category: b.category, size: b.size, limit: b.count[th] })),
  ];
  const paletteById = Object.fromEntries(palette.map((p) => [p.id, p]));

  /** Working layout — starts from the most recently edited saved layout. */
  let layout = { id: null, name: '', th, tiles: [] };
  let selected = '__townhall';
  let erasing = false;
  let hover = null;
  let pointerDown = false;

  const canvas = el('canvas', {
    width: 880, height: 880,
    style: { width: '100%', minWidth: '0', maxWidth: '760px', aspectRatio: '1', display: 'block', borderRadius: '8px', background: '#10161c', cursor: 'crosshair', touchAction: 'none' },
  });
  const ctx2d = canvas.getContext('2d');

  const paletteEl = el('div.grid', { style: { gap: '4px' } });
  const statsEl = el('div.grid.g3', { style: { gap: '12px' } });
  const savedEl = el('div');
  const nameInput = el('input', { placeholder: 'Layout name', value: layout.name, style: { flex: 1, minWidth: '140px' } });

  // ------------------------------------------------------------ geometry --
  const cell = () => canvas.width / GRID;

  function tileAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - r.left) / r.width) * GRID);
    const y = Math.floor(((clientY - r.top) / r.height) * GRID);
    return x >= 0 && x < GRID && y >= 0 && y < GRID ? { x, y } : null;
  }

  const occupies = (t) => {
    const p = paletteById[t.id];
    return p ? { x: t.x, y: t.y, w: p.size[0], h: p.size[1] } : null;
  };

  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function canPlace(id, x, y) {
    const p = paletteById[id];
    if (!p) return false;
    const [w, h] = p.size;
    if (x < 0 || y < 0 || x + w > GRID || y + h > GRID) return false;
    if (countOf(id) >= p.limit) return false;
    const box = { x, y, w, h };
    return !layout.tiles.some((t) => { const o = occupies(t); return o && overlaps(box, o); });
  }

  const countOf = (id) => layout.tiles.filter((t) => t.id === id).length;

  function place(x, y) {
    const p = paletteById[selected];
    if (!p) return;
    // snap so the structure is centred under the cursor for multi-tile pieces
    const ox = Math.max(0, Math.min(GRID - p.size[0], x - (p.size[0] > 1 ? Math.floor(p.size[0] / 2) : 0)));
    const oy = Math.max(0, Math.min(GRID - p.size[1], y - (p.size[1] > 1 ? Math.floor(p.size[1] / 2) : 0)));
    if (!canPlace(selected, ox, oy)) return;
    layout.tiles.push({ id: selected, x: ox, y: oy });
    draw(); drawPalette(); drawStats();
  }

  function erase(x, y) {
    const idx = layout.tiles.findIndex((t) => {
      const o = occupies(t);
      return o && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h;
    });
    if (idx >= 0) { layout.tiles.splice(idx, 1); draw(); drawPalette(); drawStats(); }
  }

  // -------------------------------------------------------------- drawing --
  function draw() {
    const c = cell();
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);

    ctx2d.fillStyle = '#10161c';
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);

    // grid
    ctx2d.strokeStyle = 'rgba(255,255,255,.045)';
    ctx2d.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      const p = Math.round(i * c) + .5;
      ctx2d.beginPath(); ctx2d.moveTo(p, 0); ctx2d.lineTo(p, canvas.height); ctx2d.stroke();
      ctx2d.beginPath(); ctx2d.moveTo(0, p); ctx2d.lineTo(canvas.width, p); ctx2d.stroke();
    }
    // every 4th line brighter, for eyeballing spacing
    ctx2d.strokeStyle = 'rgba(255,255,255,.09)';
    for (let i = 0; i <= GRID; i += 4) {
      const p = Math.round(i * c) + .5;
      ctx2d.beginPath(); ctx2d.moveTo(p, 0); ctx2d.lineTo(p, canvas.height); ctx2d.stroke();
      ctx2d.beginPath(); ctx2d.moveTo(0, p); ctx2d.lineTo(canvas.width, p); ctx2d.stroke();
    }

    for (const t of layout.tiles) drawTile(t, 1);

    // ghost preview
    if (hover && !erasing) {
      const p = paletteById[selected];
      if (p) {
        const ox = Math.max(0, Math.min(GRID - p.size[0], hover.x - (p.size[0] > 1 ? Math.floor(p.size[0] / 2) : 0)));
        const oy = Math.max(0, Math.min(GRID - p.size[1], hover.y - (p.size[1] > 1 ? Math.floor(p.size[1] / 2) : 0)));
        const ok = canPlace(selected, ox, oy);
        ctx2d.globalAlpha = .55;
        drawTile({ id: selected, x: ox, y: oy }, 1, ok ? null : '#ff5f56');
        ctx2d.globalAlpha = 1;
      }
    }
    if (hover && erasing) {
      ctx2d.strokeStyle = '#ff5f56';
      ctx2d.lineWidth = 2;
      ctx2d.strokeRect(hover.x * c, hover.y * c, c, c);
    }
  }

  function drawTile(t, alpha = 1, forceStroke = null) {
    const p = paletteById[t.id];
    if (!p) return;
    const c = cell();
    const col = CATEGORY_COLOR[p.category] || CATEGORY_COLOR.other;
    const x = t.x * c, y = t.y * c, w = p.size[0] * c, h = p.size[1] * c;
    const pad = p.size[0] === 1 ? 0.8 : 1.5;

    ctx2d.fillStyle = col.fill;
    ctx2d.strokeStyle = forceStroke || col.stroke;
    ctx2d.lineWidth = p.size[0] === 1 ? 1 : 1.5;
    roundRect(ctx2d, x + pad, y + pad, w - pad * 2, h - pad * 2, Math.min(4, w / 5));
    ctx2d.fill();
    ctx2d.stroke();

    if (p.size[0] >= 2) {
      ctx2d.fillStyle = col.text;
      ctx2d.font = `600 ${Math.max(7, c * (p.size[0] >= 4 ? .78 : .62))}px ${getComputedStyle(document.body).fontFamily}`;
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';
      ctx2d.fillText(abbrev(p.name), x + w / 2, y + h / 2);
    }
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // -------------------------------------------------------------- palette --
  function drawPalette() {
    mount(paletteEl, palette.map((p) => {
      const used = countOf(p.id);
      const full = used >= p.limit;
      const col = CATEGORY_COLOR[p.category] || CATEGORY_COLOR.other;
      return el('div.row', {
        onclick: () => { selected = p.id; erasing = false; drawPalette(); draw(); },
        style: {
          gap: '8px', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer',
          border: '1px solid ' + (selected === p.id && !erasing ? 'var(--gold-dim)' : 'transparent'),
          background: selected === p.id && !erasing ? 'var(--panel-3)' : 'transparent',
          opacity: full ? .45 : 1,
        },
      }, [
        el('span', { style: { width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0, background: col.fill, border: '1px solid ' + col.stroke } }),
        el('span', { style: { fontSize: '12px', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, p.name),
        el('span.num', { style: { fontSize: '11px', color: full ? 'var(--ok)' : 'var(--muted)' } }, `${used}/${p.limit}`),
        el('span', { style: { fontSize: '10px', color: 'var(--faint)' } }, `${p.size[0]}×${p.size[1]}`),
      ]);
    }));
  }

  function drawStats() {
    const placed = layout.tiles.length;
    const total = palette.reduce((a, p) => a + p.limit, 0);
    const tilesUsed = layout.tiles.reduce((a, t) => { const p = paletteById[t.id]; return a + (p ? p.size[0] * p.size[1] : 0); }, 0);
    mount(statsEl, [
      stat('Placed', `${placed}`, `of ${total} available`),
      stat('Coverage', ((tilesUsed / (GRID * GRID)) * 100).toFixed(1) + '%', `${tilesUsed} of ${GRID * GRID} tiles`),
      stat('Town Hall', countOf('__townhall') ? 'placed' : 'missing', null, countOf('__townhall') ? 'ok' : 'bad'),
    ]);
  }

  // --------------------------------------------------------------- events --
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    pointerDown = true;
    const t = tileAt(e.clientX, e.clientY);
    if (!t) return;
    if (e.button === 2 || erasing) erase(t.x, t.y); else place(t.x, t.y);
  });
  canvas.addEventListener('pointermove', (e) => {
    const t = tileAt(e.clientX, e.clientY);
    const changed = !hover || !t || hover.x !== t.x || hover.y !== t.y;
    hover = t;
    if (pointerDown && t && changed) {
      if (erasing) erase(t.x, t.y);
      else if (paletteById[selected]?.size[0] === 1) place(t.x, t.y); // drag-paint walls & traps
    }
    if (changed) draw();
  });
  canvas.addEventListener('pointerup', () => { pointerDown = false; });
  canvas.addEventListener('pointerleave', () => { pointerDown = false; hover = null; draw(); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // ----------------------------------------------------------- persistence --
  function refreshSaved() {
    const list = getState().layouts;
    mount(savedEl, list.length
      ? el('div.grid', { style: { gap: '4px' } }, list.map((l) => el('div.row', {
          style: { gap: '8px', padding: '6px 8px', borderRadius: '6px', background: l.id === layout.id ? 'var(--panel-3)' : 'var(--panel-2)' },
        }, [
          el('div', { style: { flex: 1, minWidth: 0 } }, [
            el('div', { style: { fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, l.name),
            el('div', { style: { fontSize: '11px', color: 'var(--faint)' } }, `TH${l.th} · ${l.tiles.length} structures`),
          ]),
          el('button.btn.sm.ghost', { onclick: () => loadLayout(l) }, 'Open'),
          el('button.btn.sm.ghost.danger', {
            onclick: () => { setState({ layouts: getState().layouts.filter((x) => x.id !== l.id) }); if (layout.id === l.id) layout.id = null; refreshSaved(); },
          }, icon('trash', 'nav-icon')),
        ])))
      : el('div', { style: { color: 'var(--faint)', fontSize: '12px' } }, 'No saved layouts yet.'));
  }

  function loadLayout(l) {
    if (l.th !== th) toast(`That layout was built for TH${l.th} — placement limits here are TH${th}.`, 'warn');
    layout = { id: l.id, name: l.name, th: l.th, tiles: l.tiles.map((t) => ({ ...t })) };
    nameInput.value = l.name;
    draw(); drawPalette(); drawStats(); refreshSaved();
  }

  function save() {
    const name = nameInput.value.trim() || `TH${th} layout`;
    const list = getState().layouts;
    const id = layout.id || 'ly_' + Date.now().toString(36);
    const record = { id, name, th, tiles: layout.tiles.map((t) => ({ ...t })), updated: new Date().toISOString() };
    const next = list.some((l) => l.id === id) ? list.map((l) => (l.id === id ? record : l)) : [record, ...list];
    setState({ layouts: next });
    layout.id = id; layout.name = name;
    toast('Layout saved', 'ok');
    refreshSaved();
  }

  // ------------------------------------------------------------------ view --
  mount(root, [
    el('div.view-head', [
      el('div', [
        el('h1', 'Base builder'),
        el('p', `Lay out a ${GRID}×${GRID} village. Placement limits come from your Town Hall level, so a finished layout is always buildable. Click to place, drag to paint walls, right-click to remove.`),
      ]),
      el('div.spacer'),
      el('span.tag.gold', 'TH' + th),
    ]),

    el('div.grid.builder-split', { style: { gap: '16px', alignItems: 'start' } }, [
      el('section.panel', [
        el('div.panel-head', [
          el('h2', 'Canvas'),
          el('div.spacer'),
          el('button.btn.sm' + (erasing ? '.primary' : '.ghost'), {
            onclick: (e) => { erasing = !erasing; e.target.closest('button').className = 'btn sm' + (erasing ? ' primary' : ' ghost'); drawPalette(); draw(); },
          }, 'Eraser'),
          el('button.btn.sm.ghost.danger', {
            onclick: () => { if (layout.tiles.length && confirm('Clear the canvas?')) { layout.tiles = []; draw(); drawPalette(); drawStats(); } },
          }, 'Clear'),
        ]),
        el('div.panel-body', [
          statsEl,
          el('div', { style: { marginTop: '14px', display: 'flex', justifyContent: 'center' } }, canvas),
        ]),
      ]),

      el('div.grid', { style: { gap: '16px' } }, [
        el('section.panel', [
          el('div.panel-head', el('h2', 'Structures')),
          el('div.panel-body', { style: { maxHeight: '420px', overflow: 'auto' } }, paletteEl),
        ]),
        el('section.panel', [
          el('div.panel-head', el('h2', 'Layouts')),
          el('div.panel-body', [
            el('div.row', { style: { marginBottom: '10px' } }, [
              nameInput,
              el('button.btn.primary.sm', { onclick: save }, 'Save'),
            ]),
            el('div.row', { style: { marginBottom: '10px', gap: '6px' } }, [
              el('button.btn.sm.ghost', {
                onclick: () => { layout = { id: null, name: '', th, tiles: [] }; nameInput.value = ''; draw(); drawPalette(); drawStats(); refreshSaved(); },
              }, [icon('plus', 'nav-icon'), 'New']),
              el('button.btn.sm.ghost', {
                title: 'Copy this layout as JSON',
                onclick: async () => {
                  const json = JSON.stringify({ app: 'clashverse-layout', th, tiles: layout.tiles }, null, 0);
                  try { await navigator.clipboard.writeText(json); toast('Layout JSON copied'); }
                  catch { toast('Clipboard unavailable — export from the top bar instead', 'warn'); }
                },
              }, 'Copy JSON'),
            ]),
            savedEl,
          ]),
        ]),
      ]),
    ]),
  ]);

  draw(); drawPalette(); drawStats(); refreshSaved();

  const existing = getState().layouts.find((l) => l.th === th);
  if (existing) loadLayout(existing);

  return root;
}
