'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  GRID, TOWN_HALL_ID, abbrev, canPlace, countOf, eraseAt, paletteFor,
  lineTiles, paletteIndex, place, sanitise, snapOrigin, statsFor,
  type BaseLayout, type Palette, type PaletteCategory, type PaletteEntry, type Tile,
} from '@/lib/base/layout';
import { drawIcon, type Ink } from '@/lib/base/icons';
import { TERRAIN, geometry, paintTerrain, tileFromPoint } from '@/lib/base/terrain';
import { MAX_TH } from '@/lib/game/town-halls';
import { usePlannerState } from '@/lib/store';
import { useResolvedTheme } from '@/lib/theme';
import { Panel, Stat } from '@/components/primitives';

/**
 * Canvas is drawn at a fixed resolution and scaled by CSS. It is well above the
 * ~760px display width on purpose: structure icons carry fine detail, and at
 * 1:1 they turn to mush on a 2x display.
 */
const RESOLUTION = 1320;
const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

interface CatStyle {
  ink: Ink;
  /** Footprint plate under the icon. A layout editor has to show which tiles
   *  a structure occupies, so the icon alone is not enough. */
  plate: string;
  edge: string;
  /** Swatch colour for the palette list. */
  chip: string;
}

const STYLE: Record<PaletteCategory, CatStyle> = {
  defense: {
    ink: { body: '#b3574a', shade: '#8a3f35', accent: '#f0c05a', line: '#2b1a17' },
    plate: 'rgba(46,20,16,.42)', edge: 'rgba(240,150,130,.55)', chip: '#b3574a',
  },
  trap: {
    ink: { body: '#a8862f', shade: '#7d6222', accent: '#e8c65a', line: '#2b230f' },
    plate: 'rgba(48,36,10,.40)', edge: 'rgba(232,198,90,.5)', chip: '#c99b2e',
  },
  resource: {
    ink: { body: '#b09a4c', shade: '#7f6f37', accent: '#f2d564', line: '#2b2410' },
    plate: 'rgba(44,38,12,.40)', edge: 'rgba(240,214,100,.5)', chip: '#c0a83a',
  },
  army: {
    ink: { body: '#8e5fb0', shade: '#6b448a', accent: '#dcaef2', line: '#241832' },
    plate: 'rgba(38,22,50,.44)', edge: 'rgba(197,140,230,.5)', chip: '#a76bd0',
  },
  wall: {
    ink: { body: '#8f97a2', shade: '#6b727c', accent: '#c3ccd8', line: '#2a2e33' },
    plate: 'rgba(28,32,36,.40)', edge: 'rgba(180,192,206,.5)', chip: '#7b8797',
  },
  other: {
    ink: { body: '#5a8fb8', shade: '#436e90', accent: '#a8d8f0', line: '#16232e' },
    plate: 'rgba(16,32,44,.42)', edge: 'rgba(140,200,236,.5)', chip: '#4a8ec0',
  },
  townhall: {
    ink: { body: '#c99a3c', shade: '#9c7429', accent: '#f4cd63', line: '#3a2a0c' },
    plate: 'rgba(54,38,8,.44)', edge: 'rgba(244,205,99,.62)', chip: '#f0b429',
  },
};

const styleOf = (c: PaletteCategory): CatStyle => STYLE[c] ?? STYLE.other;

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
    // The canvas is wider than the grid — scenery rings the field — so the
    // point is resolved against that geometry, not against the raw bounds.
    return tileFromPoint(
      ((clientX - r.left) / r.width) * RESOLUTION,
      ((clientY - r.top) / r.height) * RESOLUTION,
      RESOLUTION, GRID,
    );
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

  /**
   * Two cached layers under the live one. Terrain is thousands of scattered
   * tufts and rocks; structures are up to a few hundred vector icons. Both are
   * static while the pointer moves, so redrawing them on every hover — which is
   * every few milliseconds during a drag — is what would make this feel slow.
   * Each layer repaints only when the inputs it actually depends on change.
   */
  const terrainLayer = useRef<{ theme: string; c: HTMLCanvasElement } | null>(null);
  const structLayer = useRef<{ theme: string; tiles: Tile[]; palette: Palette; c: HTMLCanvasElement } | null>(null);

  useEffect(() => {
    const g = canvas?.getContext('2d');
    if (!g) return;
    const { cell, origin } = geometry(RESOLUTION, GRID);

    if (terrainLayer.current?.theme !== theme) {
      const c = document.createElement('canvas');
      c.width = c.height = RESOLUTION;
      const tg = c.getContext('2d');
      if (!tg) return;
      paintTerrain(tg, { size: RESOLUTION, grid: GRID, theme: TERRAIN[theme] });
      terrainLayer.current = { theme, c };
    }

    const cached = structLayer.current;
    if (!cached || cached.tiles !== tiles || cached.palette !== palette || cached.theme !== theme) {
      const c = cached?.c ?? document.createElement('canvas');
      c.width = c.height = RESOLUTION;
      const sg = c.getContext('2d');
      if (!sg) return;
      sg.clearRect(0, 0, RESOLUTION, RESOLUTION);
      const walls = wallSet(palette, tiles);
      for (const t of tiles) drawStructure(sg, palette.get(t.id), t.x, t.y, cell, origin, walls);
      structLayer.current = { theme, tiles, palette, c };
    }

    g.clearRect(0, 0, RESOLUTION, RESOLUTION);
    if (terrainLayer.current) g.drawImage(terrainLayer.current.c, 0, 0);
    if (structLayer.current) g.drawImage(structLayer.current.c, 0, 0);

    if (hover) {
      if (erasing) {
        // Outline what would actually go, not the tile under the cursor: on a
        // 4x4 those differ, and the tile-sized box makes the eraser look like
        // it will nibble a corner off.
        const box = topAt(palette, tiles, hover.x, hover.y);
        const p = box ? palette.get(box.id) : undefined;
        g.strokeStyle = '#ff5f56';
        g.lineWidth = Math.max(2, cell * 0.14);
        g.strokeRect(
          origin + (box ?? hover).x * cell, origin + (box ?? hover).y * cell,
          (p?.size[0] ?? 1) * cell, (p?.size[1] ?? 1) * cell,
        );
      } else {
        const p = palette.get(selected);
        if (p) {
          const at = snapOrigin(p.size, hover.x, hover.y);
          const ok = canPlace(palette, tiles, selected, at.x, at.y);
          g.globalAlpha = 0.6;
          drawStructure(g, p, at.x, at.y, cell, origin, null, ok ? undefined : '#ff5f56');
          g.globalAlpha = 1;
        }
      }
    }
    // `theme` is not read for the CSS palette any more, but it still selects the
    // terrain and must stay a dependency so a palette change repaints.
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

/** Tile keys of every wall, so a wall can see its neighbours in O(1). */
function wallSet(palette: Palette, tiles: Tile[]): Set<string> {
  const out = new Set<string>();
  for (const t of tiles) {
    if (palette.get(t.id)?.category === 'wall') out.add(`${t.x},${t.y}`);
  }
  return out;
}

/** The structure covering a tile, topmost first — what the eraser would take. */
function topAt(palette: Palette, tiles: Tile[], x: number, y: number): Tile | null {
  for (let i = tiles.length - 1; i >= 0; i--) {
    const p = palette.get(tiles[i].id);
    if (!p) continue;
    const t = tiles[i];
    if (x >= t.x && x < t.x + p.size[0] && y >= t.y && y < t.y + p.size[1]) return t;
  }
  return null;
}

/**
 * Walls are drawn as masonry that fuses with its neighbours rather than as
 * separate blocks. A wall line is the one structure whose whole point is being
 * continuous, and 40 individually rounded squares read as a dotted trail.
 */
function drawWall(
  g: CanvasRenderingContext2D, style: CatStyle,
  tx: number, ty: number, cell: number, origin: number,
  walls: Set<string> | null, forceStroke?: string,
) {
  const x = origin + tx * cell;
  const y = origin + ty * cell;
  const pad = cell * 0.1;
  const near = (dx: number, dy: number) => walls?.has(`${tx + dx},${ty + dy}`) ?? false;

  g.fillStyle = style.ink.body;
  roundRect(g, x + pad, y + pad, cell - pad * 2, cell - pad * 2, cell * 0.22);
  g.fill();

  // Bridge the gap toward each adjacent wall so a run comes out solid.
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
    if (!near(dx, dy)) continue;
    g.fillRect(
      x + (dx === 0 ? pad : dx > 0 ? cell - pad * 2 : 0),
      y + (dy === 0 ? pad : dy > 0 ? cell - pad * 2 : 0),
      dx === 0 ? cell - pad * 2 : pad * 2,
      dy === 0 ? cell - pad * 2 : pad * 2,
    );
  }

  g.fillStyle = style.ink.accent;
  g.fillRect(x + pad * 1.6, y + pad * 1.6, cell - pad * 3.2, cell * 0.16);
  g.strokeStyle = forceStroke ?? style.ink.line;
  g.lineWidth = Math.max(1, cell * 0.05);
  roundRect(g, x + pad, y + pad, cell - pad * 2, cell - pad * 2, cell * 0.22);
  g.stroke();
}

function drawStructure(
  g: CanvasRenderingContext2D,
  p: PaletteEntry | undefined,
  tx: number, ty: number, cell: number, origin: number,
  walls: Set<string> | null,
  forceStroke?: string,
) {
  if (!p) return;
  const style = styleOf(p.category);

  if (p.category === 'wall') {
    drawWall(g, style, tx, ty, cell, origin, walls, forceStroke);
    return;
  }

  const x = origin + tx * cell;
  const y = origin + ty * cell;
  const w = p.size[0] * cell;
  const h = p.size[1] * cell;
  const pad = Math.max(0.5, cell * 0.06);
  const r = Math.min(cell * 0.3, w / 6);

  // Footprint plate: the icon says what it is, the plate says which tiles it
  // takes. Both matter here — this is a placement tool, not a picture.
  roundRect(g, x + pad, y + pad, w - pad * 2, h - pad * 2, r);
  g.fillStyle = style.plate;
  g.fill();
  g.strokeStyle = forceStroke ?? style.edge;
  g.lineWidth = Math.max(1, cell * 0.06);
  g.stroke();

  const inset = Math.min(w, h) * 0.08;
  if (drawIcon(g, p.id, x + inset, y + inset, Math.min(w, h) - inset * 2, style.ink)) return;

  // No icon for this id: fall back to initials so a newly added building still
  // renders as something a person can identify.
  g.fillStyle = style.ink.accent;
  g.font = `700 ${Math.max(7, cell * (p.size[0] >= 4 ? 0.7 : 0.55))}px ${FONT}`;
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

/** The same icon as the canvas, at chip size, so the list and board agree. */
function IconChip({ entry }: { entry: PaletteEntry }) {
  const [c, setC] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const g = c?.getContext('2d');
    if (!g) return;
    const style = styleOf(entry.category);
    g.clearRect(0, 0, 40, 40);
    roundRect(g, 1, 1, 38, 38, 9);
    g.fillStyle = style.plate;
    g.fill();
    g.strokeStyle = style.edge;
    g.lineWidth = 2;
    g.stroke();
    if (!drawIcon(g, entry.id, 4, 4, 32, style.ink)) {
      g.fillStyle = style.ink.accent;
      g.font = `700 15px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(abbrev(entry.name), 20, 21);
    }
  }, [c, entry]);
  return <canvas ref={setC} width={40} height={40} aria-hidden className="h-5 w-5 shrink-0" />;
}

function PaletteRow({ entry, used, active, onSelect }: {
  entry: PaletteEntry; used: number; active: boolean; onSelect: () => void;
}) {
  const full = used >= entry.limit;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition ${
        active ? 'border-gold/50 bg-panel-3' : 'border-transparent hover:bg-panel-2'
      } ${full ? 'opacity-45' : ''}`}
    >
      <IconChip entry={entry} />
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
