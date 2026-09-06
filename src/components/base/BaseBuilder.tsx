'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  GRID, TOWN_HALL_ID, abbrev, canPlace, countOf, eraseAt, paletteFor,
  lineTiles, paletteIndex, place, sanitise, snapOrigin, statsFor,
  type BaseLayout, type PaletteCategory, type PaletteEntry, type Tile,
} from '@/lib/base/layout';
import { MAX_TH } from '@/lib/game/town-halls';
import { usePlannerState } from '@/lib/store';
import { useResolvedTheme } from '@/lib/theme';
import { Panel, Stat } from '@/components/primitives';

/** Canvas is drawn at a fixed resolution and scaled by CSS. */
const RESOLUTION = 880;
const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Read from the live palette so the canvas follows the theme like everything else. */
function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  const dark = cs.getPropertyValue('color-scheme').includes('dark');
  return {
    ground: v('--color-panel-2', '#10161c'),
    grid: dark ? 'rgba(255,255,255,.05)' : 'rgba(90,60,20,.10)',
    gridMajor: dark ? 'rgba(255,255,255,.10)' : 'rgba(90,60,20,.20)',
  };
}

const COLOR: Record<PaletteCategory, { fill: string; stroke: string; text: string }> = {
  defense: { fill: '#4a2320', stroke: '#c0574d', text: '#ffb3ab' },
  trap: { fill: '#4a3410', stroke: '#c99b2e', text: '#ffd98a' },
  resource: { fill: '#3f3a14', stroke: '#c0a83a', text: '#f0dc8a' },
  army: { fill: '#3a2447', stroke: '#a76bd0', text: '#e0b3ff' },
  wall: { fill: '#33383f', stroke: '#7b8797', text: '#c3ccd8' },
  other: { fill: '#1d3446', stroke: '#4a8ec0', text: '#9fd4ff' },
  townhall: { fill: '#4a3a12', stroke: '#f0b429', text: '#ffe6a8' },
};

const UNDO_DEPTH = 40;

export function BaseBuilder() {
  const { state, setState, loaded } = usePlannerState();
  const theme = useResolvedTheme();
  const th = state.th;

  const entries = useMemo(() => paletteFor(th), [th]);
  const palette = useMemo(() => paletteIndex(entries), [entries]);

  const [tiles, setTiles] = useState<Tile[]>([]);
  const [history, setHistory] = useState<Tile[][]>([]);
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string>(TOWN_HALL_ID);
  const [erasing, setErasing] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  /**
   * The canvas lives in state, not a ref, so the draw effect can depend on it.
   * With a ref the effect runs once while the loading placeholder is still
   * mounted, finds nothing to draw on, and never re-runs — the grid stays blank
   * until the first click happens to change another dependency.
   */
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const dragging = useRef(false);
  /** Last tile painted during a drag, so a fast drag doesn't leave gaps. */
  const lastPainted = useRef<{ x: number; y: number } | null>(null);

  const commit = useCallback((next: Tile[]) => {
    setHistory((h) => [...h.slice(-(UNDO_DEPTH - 1)), tiles]);
    setTiles(next);
  }, [tiles]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      setTiles(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }, []);

  /* ------------------------------------------------------------- pointer */

  const tileAt = useCallback((clientX: number, clientY: number) => {
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - r.left) / r.width) * GRID);
    const y = Math.floor(((clientY - r.top) / r.height) * GRID);
    return x >= 0 && x < GRID && y >= 0 && y < GRID ? { x, y } : null;
  }, [canvas]);

  const apply = useCallback((x: number, y: number, erase: boolean) => {
    if (erase) {
      const next = eraseAt(palette, tiles, x, y);
      if (next !== tiles) commit(next);
      return;
    }
    const next = place(palette, tiles, selected, x, y);
    if (next) commit(next);
  }, [palette, tiles, selected, commit]);

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    const t = tileAt(e.clientX, e.clientY);
    if (!t) return;
    lastPainted.current = t;
    apply(t.x, t.y, erasing || e.button === 2);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    const t = tileAt(e.clientX, e.clientY);
    const moved = !hover || !t || hover.x !== t.x || hover.y !== t.y;
    if (moved) setHover(t);
    if (!dragging.current || !t || !moved) return;

    // Drag-painting only makes sense for single-tile pieces: walls and traps.
    const paintable = erasing || palette.get(selected)?.size[0] === 1;
    if (!paintable) return;

    // Pointer events are sampled, so a quick drag reports tiles several apart.
    // Walking the line between them is what makes a dragged wall continuous
    // instead of a dotted trail.
    const path = lineTiles(lastPainted.current ?? t, t);
    lastPainted.current = t;
    let next = tiles;
    for (const step of path) {
      next = erasing
        ? eraseAt(palette, next, step.x, step.y)
        : place(palette, next, selected, step.x, step.y) ?? next;
    }
    if (next !== tiles) commit(next);
  }

  const endDrag = () => { dragging.current = false; lastPainted.current = null; };

  /* ------------------------------------------------------------- drawing */

  useEffect(() => {
    const g = canvas?.getContext('2d');
    if (!g) return;
    const cell = RESOLUTION / GRID;
    const colors = themeColors();

    g.fillStyle = colors.ground;
    g.fillRect(0, 0, RESOLUTION, RESOLUTION);

    g.lineWidth = 1;
    for (const [step, stroke] of [[1, colors.grid], [4, colors.gridMajor]] as const) {
      g.strokeStyle = stroke;
      for (let i = 0; i <= GRID; i += step) {
        const p = Math.round(i * cell) + 0.5;
        g.beginPath(); g.moveTo(p, 0); g.lineTo(p, RESOLUTION); g.stroke();
        g.beginPath(); g.moveTo(0, p); g.lineTo(RESOLUTION, p); g.stroke();
      }
    }

    for (const t of tiles) drawTile(g, palette.get(t.id), t.x, t.y, cell);

    if (hover) {
      if (erasing) {
        g.strokeStyle = '#ff5f56';
        g.lineWidth = 2;
        g.strokeRect(hover.x * cell, hover.y * cell, cell, cell);
      } else {
        const p = palette.get(selected);
        if (p) {
          const at = snapOrigin(p.size, hover.x, hover.y);
          const ok = canPlace(palette, tiles, selected, at.x, at.y);
          g.globalAlpha = 0.55;
          drawTile(g, p, at.x, at.y, cell, ok ? undefined : '#ff5f56');
          g.globalAlpha = 1;
        }
      }
    }
    // `theme` is not read here — themeColors() re-reads the live CSS variables —
    // but it must stay a dependency so a palette change triggers a repaint.
  }, [canvas, tiles, hover, selected, erasing, palette, theme]);

  /* --------------------------------------------------------- persistence */

  const layouts = state.layouts;

  function save() {
    const label = name.trim() || `TH${th} layout`;
    const id = layoutId ?? `ly_${Date.now().toString(36)}`;
    const record: BaseLayout = { id, name: label, th, tiles, updated: new Date().toISOString() };
    setState((s) => ({
      layouts: s.layouts.some((l) => l.id === id)
        ? s.layouts.map((l) => (l.id === id ? record : l))
        : [record, ...s.layouts],
    }));
    setLayoutId(id);
    setName(label);
    setNote(`Saved “${label}”.`);
  }

  function open(l: BaseLayout) {
    // A layout built at a higher Town Hall can hold structures this one cannot,
    // so it is filtered rather than trusted — and we say what was dropped.
    const kept = l.th === th ? l.tiles : sanitise(palette, l.tiles);
    commit(kept);
    setLayoutId(l.id);
    setName(l.name);
    setNote(kept.length < l.tiles.length
      ? `Built for TH${l.th}: ${l.tiles.length - kept.length} structures TH${th} cannot build were dropped.`
      : null);
  }

  function remove(id: string) {
    setState((s) => ({ layouts: s.layouts.filter((l) => l.id !== id) }));
    if (layoutId === id) setLayoutId(null);
  }

  function changeTh(next: number) {
    const kept = sanitise(paletteIndex(paletteFor(next)), tiles);
    setState({ th: next });
    commit(kept);
    setNote(kept.length < tiles.length
      ? `${tiles.length - kept.length} structures dropped — TH${next} cannot build them.`
      : null);
  }

  const stats = statsFor(palette, entries, tiles);

  if (!loaded) {
    return <Panel><p className="py-16 text-center text-muted">Loading your village…</p></Panel>;
  }

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Panel
        title="Canvas"
        action={
          <div className="flex items-center gap-1.5">
            <Toolbtn onClick={undo} disabled={!history.length}>Undo</Toolbtn>
            <Toolbtn onClick={() => setErasing((e) => !e)} active={erasing}>Eraser</Toolbtn>
            <Toolbtn onClick={() => tiles.length && commit([])} disabled={!tiles.length} danger>Clear</Toolbtn>
          </div>
        }
      >
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Placed" value={String(stats.placed)} sub={`of ${stats.available} available`} />
          <Stat label="Coverage" value={`${stats.coverage.toFixed(1)}%`}
            sub={`${stats.tilesUsed} of ${GRID * GRID} tiles`} />
          <Stat label="Town Hall" value={stats.hasTownHall ? 'placed' : 'missing'}
            tone={stats.hasTownHall ? 'ok' : 'bad'} />
        </div>

        {note && <p className="mt-3 rounded-md border border-warn/40 bg-warn/[.07] px-3 py-2 text-[13px] text-text-2">{note}</p>}

        <div className="mt-4 flex justify-center">
          <canvas
            ref={setCanvas}
            width={RESOLUTION}
            height={RESOLUTION}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={() => { endDrag(); setHover(null); }}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={`Village grid, ${GRID} by ${GRID} tiles, ${stats.placed} structures placed`}
            className="block aspect-square w-full max-w-[760px] touch-none rounded-[10px] border border-line bg-panel-2"
            style={{ cursor: erasing ? 'not-allowed' : 'crosshair' }}
          />
        </div>
        <p className="mt-3 text-center text-[12px] text-faint">
          Click to place · drag to paint walls and traps · right-click to remove
        </p>
      </Panel>

      <div className="grid gap-4">
        <Panel title="Town Hall" action={<span className="num text-[13px] text-gold">TH{th}</span>}>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            Placement limits for
            <select
              value={th}
              onChange={(e) => changeTh(Number(e.target.value))}
              className="num rounded-md border border-line bg-panel-2 px-2 py-1 text-text outline-none focus:border-gold/50"
            >
              {Array.from({ length: MAX_TH }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>TH{n}</option>
              ))}
            </select>
          </label>
        </Panel>

        <Panel title="Structures" tight>
          <div className="max-h-[420px] overflow-auto p-2">
            {entries.map((p) => (
              <PaletteRow
                key={p.id}
                entry={p}
                used={countOf(tiles, p.id)}
                active={selected === p.id && !erasing}
                onSelect={() => { setSelected(p.id); setErasing(false); }}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Layouts">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Layout name"
              className="min-w-0 flex-1 rounded-md border border-line bg-panel-2 px-3 py-1.5 text-[13px] outline-none focus:border-gold/50"
            />
            <button
              onClick={save}
              className="raised rounded-[10px] border border-gold-2 bg-gold px-3 py-1.5 text-[13px] font-bold text-ink hover:brightness-105"
            >
              Save
            </button>
          </div>
          <div className="mt-2 flex gap-1.5">
            <Toolbtn onClick={() => { commit([]); setLayoutId(null); setName(''); setNote(null); }}>New</Toolbtn>
          </div>

          <div className="mt-3 grid gap-1">
            {layouts.length ? layouts.map((l) => (
              <div
                key={l.id}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 ${l.id === layoutId ? 'bg-panel-3' : 'bg-panel-2'}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]">{l.name}</div>
                  <div className="num text-[11px] text-faint">TH{l.th} · {l.tiles.length} structures</div>
                </div>
                <Toolbtn onClick={() => open(l)}>Open</Toolbtn>
                <Toolbtn onClick={() => remove(l.id)} danger>Delete</Toolbtn>
              </div>
            )) : (
              <p className="text-[12px] text-faint">No saved layouts yet.</p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function drawTile(
  g: CanvasRenderingContext2D,
  p: PaletteEntry | undefined,
  tx: number, ty: number, cell: number,
  forceStroke?: string,
) {
  if (!p) return;
  const col = COLOR[p.category] ?? COLOR.other;
  const x = tx * cell, y = ty * cell, w = p.size[0] * cell, h = p.size[1] * cell;
  const pad = p.size[0] === 1 ? 0.8 : 1.5;

  g.fillStyle = col.fill;
  g.strokeStyle = forceStroke ?? col.stroke;
  g.lineWidth = p.size[0] === 1 ? 1 : 1.5;
  roundRect(g, x + pad, y + pad, w - pad * 2, h - pad * 2, Math.min(4, w / 5));
  g.fill();
  g.stroke();

  // A 1x1 is too small for even two letters; leave walls and traps unlabelled.
  if (p.size[0] < 2) return;
  g.fillStyle = col.text;
  g.font = `600 ${Math.max(7, cell * (p.size[0] >= 4 ? 0.78 : 0.62))}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(abbrev(p.name), x + w / 2, y + h / 2);
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function PaletteRow({ entry, used, active, onSelect }: {
  entry: PaletteEntry; used: number; active: boolean; onSelect: () => void;
}) {
  const full = used >= entry.limit;
  const col = COLOR[entry.category] ?? COLOR.other;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition ${
        active ? 'border-gold/50 bg-panel-3' : 'border-transparent hover:bg-panel-2'
      } ${full ? 'opacity-45' : ''}`}
    >
      <span
        className="h-3.5 w-3.5 shrink-0 rounded-[3px] border"
        style={{ background: col.fill, borderColor: col.stroke }}
      />
      <span className="flex-1 truncate text-[12px]">{entry.name}</span>
      <span className={`num text-[11px] ${full ? 'text-ok' : 'text-muted'}`}>{used}/{entry.limit}</span>
      <span className="num text-[10px] text-faint">{entry.size[0]}×{entry.size[1]}</span>
    </button>
  );
}

function Toolbtn({ children, onClick, active, danger, disabled }: {
  children: React.ReactNode; onClick: () => void;
  active?: boolean; danger?: boolean; disabled?: boolean;
}) {
  const tone = active
    ? 'border-gold bg-gold text-ink'
    : danger
      ? 'border-line bg-panel-2 text-bad hover:bg-panel-3'
      : 'border-line bg-panel-2 text-text-2 hover:bg-panel-3';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-2.5 py-1 text-[12px] font-semibold transition disabled:opacity-40 disabled:hover:bg-panel-2 ${tone}`}
    >
      {children}
    </button>
  );
}
