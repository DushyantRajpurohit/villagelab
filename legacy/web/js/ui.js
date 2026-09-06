/** Tiny hyperscript + formatting helpers. No framework, no build step. */

/**
 * el('div.panel', {onclick}, [children])  |  el('span', 'text')
 * Tag string supports #id and .class shorthand.
 */
export function el(spec, props, children) {
  const [, tag = 'div', rest = ''] = /^([a-z0-9]*)(.*)$/i.exec(spec) || [];
  const node = document.createElement(tag || 'div');

  for (const m of rest.matchAll(/([.#])([\w-]+)/g)) {
    if (m[1] === '.') node.classList.add(m[2]);
    else node.id = m[2];
  }

  if (props != null && (typeof props === 'string' || typeof props === 'number' || Array.isArray(props) || props instanceof Node)) {
    children = props;
    props = null;
  }

  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className += (node.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  }

  append(node, children);
  return node;
}

export function append(node, children) {
  if (children == null || children === false) return node;
  if (Array.isArray(children)) { children.forEach((c) => append(node, c)); return node; }
  node.appendChild(children instanceof Node ? children : document.createTextNode(String(children)));
  return node;
}

export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };
export const mount = (node, ...kids) => { clear(node); append(node, kids); return node; };
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ------------------------------------------------------------- formatting --

export function fmtResource(v) {
  if (v == null) return '—';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
  if (v >= 1000) return (v / 1000).toFixed(v >= 10_000 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(Math.round(v));
}

export function fmtDuration(hours) {
  if (hours == null) return '—';
  if (hours === 0) return 'instant';
  const total = Math.round(hours * 60);
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  const parts = [];
  if (d) parts.push(d + 'd');
  if (h) parts.push(h + 'h');
  if (m && !d) parts.push(m + 'm');
  return parts.join(' ') || '0m';
}

export const fmtInt = (v) => (v == null ? '—' : Number(v).toLocaleString('en-US'));

export function fmtWhen(iso) {
  const d = typeof iso === 'string' ? parseCocDate(iso) : iso;
  if (!d || isNaN(d)) return '—';
  const diff = d - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const unit = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
  return diff >= 0 ? `in ${unit}` : `${unit} ago`;
}

/** The API uses a compact ISO variant: 20240115T103000.000Z */
export function parseCocDate(s) {
  if (!s) return null;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(s);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

/** A resource-coloured number, with a "≈" marker when the value is interpolated. */
export function res(amount, kind, est = false) {
  return el(`span.res.${kind}`, [
    est ? el('span.est-mark', { title: 'Interpolated estimate — not a verified in-game value' }, '≈') : null,
    fmtResource(amount),
  ]);
}

export function bar(pct, tone = '') {
  return el('div.bar', el('i' + (tone ? '.' + tone : ''), { style: { width: Math.max(0, Math.min(100, pct)) + '%' } }));
}

export function stat(label, value, sub, tone) {
  return el('div.stat', [
    el('div.stat-label', label),
    el('div.stat-value', { style: tone ? { color: `var(--${tone})` } : null }, value),
    sub ? el('div.stat-sub', sub) : null,
  ]);
}

export function panel(title, body, actions) {
  return el('section.panel', [
    title ? el('div.panel-head', [el('h2', title), el('div.spacer'), actions]) : null,
    el('div.panel-body' + (body?.dataset?.tight ? '.tight' : ''), body),
  ]);
}

export function empty(title, msg, action) {
  return el('div.empty', [el('h3', title), msg ? el('div', msg) : null, action ? el('div', { style: { marginTop: '14px' } }, action) : null]);
}

export function banner(text, tone = '') {
  return el('div.banner' + (tone ? '.' + tone : ''), text);
}

/** Icon set — inline SVG paths, stroke-based, 24x24 viewBox. */
const ICONS = {
  player: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  planner: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  war: 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M6 18l3-3M3 21l3-3',
  base: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  search: 'M21 21l-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
  refresh: 'M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16',
  plus: 'M12 5v14M5 12h14',
  trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  hammer: 'm15 12-8.5 8.5a2.1 2.1 0 0 1-3-3L12 9M17.6 6.4 21 3M14 8l2 2M9.5 3.5 12 6l3-3-2.5-2.5a2 2 0 0 0-3 0Z',
};

export function icon(name, cls = 'nav-icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', cls);
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', ICONS[name] || ICONS.player);
  svg.appendChild(p);
  return svg;
}

/** Sortable table. columns: {key, label, num?, render?(row), sort?(row)} */
export function table(columns, rows, opts = {}) {
  let sortKey = opts.sortKey ?? null;
  let sortDir = opts.sortDir ?? -1;

  const wrap = el('div.scroll', { style: { maxHeight: opts.maxHeight || 'none' } });
  const tbl = el('table');
  const thead = el('thead');
  const tbody = el('tbody');
  tbl.append(thead, tbody);
  wrap.append(tbl);

  const valueOf = (row, col) => (col.sort ? col.sort(row) : row[col.key]);

  function draw() {
    const sorted = [...rows];
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      // sortDir: 1 = ascending, -1 = descending
      sorted.sort((a, b) => {
        const x = valueOf(a, col), y = valueOf(b, col);
        if (typeof x === 'string' || typeof y === 'string') return String(x).localeCompare(String(y)) * sortDir;
        return ((x ?? 0) - (y ?? 0)) * sortDir;
      });
    }

    mount(thead, el('tr', columns.map((c) => el('th' + (c.num ? '.num' : '') + (c.sortable === false ? '' : '.sortable'), {
      onclick: c.sortable === false ? null : () => {
        if (sortKey === c.key) sortDir = -sortDir; else { sortKey = c.key; sortDir = -1; }
        draw();
      },
    }, [c.label, sortKey === c.key ? el('span.arrow', sortDir === -1 ? ' ↓' : ' ↑') : null]))));

    mount(tbody, sorted.length
      ? sorted.map((row, i) => el('tr', columns.map((c) => el('td' + (c.num ? '.num' : ''), c.render ? c.render(row, i) : String(row[c.key] ?? '—')))))
      : el('tr', el('td', { colspan: columns.length }, empty('Nothing to show', opts.emptyMsg))));
  }

  draw();
  return wrap;
}

/** Debounce for search-as-you-type. */
export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function toast(msg, tone = '') {
  const t = el('div.banner' + (tone ? '.' + tone : ''), {
    style: {
      position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 999, boxShadow: 'var(--shadow)', background: 'var(--panel-3)',
    },
  }, msg);
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2400);
}
