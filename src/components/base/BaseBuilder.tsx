'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  GRID, TOWN_HALL_ID, abbrev, canPlace, countOf, eraseAt, paletteFor,
  lineTiles, paletteIndex, place, sanitise, snapOrigin, statsFor,
  type BaseLayout, type Palette, type PaletteCategory, type PaletteEntry, type Tile,
} from '@/lib/base/layout';
import { drawIcon, type Ink } from '@/lib/base/icons';
import { TERRAIN, paintTerrain } from '@/lib/base/terrain';
import {
  depth, footprint, isoCanvas, toTile, tileDiamond, trace, type Iso,
} from '@/lib/base/iso';
import { sprite, spriteUrl } from '@/lib/base/sprites';
import { MAX_TH } from '@/lib/game/town-halls';
import { usePlannerState } from '@/lib/store';
import { useResolvedTheme } from '@/lib/theme';
import { Panel, Stat } from '@/components/primitives';

/**
 * The board is isometric, so its canvas is a wide rectangle rather than a
 * square: the 44x44 field projects to a 2:1 diamond, plus an apron of scenery
 * and headroom for sprites standing up at the back row.
 */
const VIEW = isoCanvas(GRID);
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
    // Screen space to canvas space, then canvas space to the isometric grid.
    return toTile(
      VIEW,
      ((clientX - r.left) / r.width) * VIEW.width,
      ((clientY - r.top) / r.height) * VIEW.height,
      GRID,
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
   * Sprites arrive asynchronously, so a load has to invalidate the cached
   * structure layer and force a repaint — otherwise the board keeps showing
   * the vector fallback until something else happens to change.
   */
  const [spriteTick, setSpriteTick] = useState(0);
  const onSpriteReady = useCallback(() => setSpriteTick((t) => t + 1), []);

  /**
   * Two cached layers under the live one. Terrain is ~2000 diamonds plus
   * scenery; structures are up to a few hundred sprites. Both are static while
   * the pointer moves, so redrawing them on every hover — which is every few
   * milliseconds during a drag — is what would make this feel slow. Each layer
   * repaints only when the inputs it actually depends on change.
   */
  const terrainLayer = useRef<{ theme: string; c: HTMLCanvasElement } | null>(null);
  const structLayer = useRef<
    { theme: string; tiles: Tile[]; palette: Palette; tick: number; c: HTMLCanvasElement } | null
  >(null);

  useEffect(() => {
    const g = canvas?.getContext('2d');
    if (!g) return;

    if (terrainLayer.current?.theme !== theme) {
      const c = document.createElement('canvas');
      c.width = VIEW.width;
      c.height = VIEW.height;
      const tg = c.getContext('2d');
      if (!tg) return;
      paintTerrain(tg, {
        width: VIEW.width, height: VIEW.height, grid: GRID, iso: VIEW, theme: TERRAIN[theme],
      });
      terrainLayer.current = { theme, c };
    }

    const cached = structLayer.current;
    if (!cached || cached.tiles !== tiles || cached.palette !== palette
        || cached.theme !== theme || cached.tick !== spriteTick) {
      const c = cached?.c ?? document.createElement('canvas');
      c.width = VIEW.width;
      c.height = VIEW.height;
      const sg = c.getContext('2d');
      if (!sg) return;
      sg.clearRect(0, 0, VIEW.width, VIEW.height);
      // Painter's algorithm: back to front, or a Town Hall swallows the wall
      // standing in front of it.
      const order = [...tiles].sort((a, b) => {
        const pa = palette.get(a.id), pb = palette.get(b.id);
        if (!pa || !pb) return 0;
        return depth(a.x, a.y, pa.size[0], pa.size[1]) - depth(b.x, b.y, pb.size[0], pb.size[1]);
      });
      for (const t of order) drawStructure(sg, palette.get(t.id), t.x, t.y, VIEW, onSpriteReady);
      structLayer.current = { theme, tiles, palette, tick: spriteTick, c };
    }

    g.clearRect(0, 0, VIEW.width, VIEW.height);
    if (terrainLayer.current) g.drawImage(terrainLayer.current.c, 0, 0);
    if (structLayer.current) g.drawImage(structLayer.current.c, 0, 0);

    if (hover) {
      if (erasing) {
        // Outline what would actually go, not the tile under the cursor: on a
        // 4x4 those differ, and a tile-sized diamond makes the eraser look like
        // it will nibble a corner off.
        const box = topAt(palette, tiles, hover.x, hover.y);
        const p = box ? palette.get(box.id) : undefined;
        if (box && p) {
          trace(g, footprint(VIEW, box.x, box.y, p.size[0], p.size[1]).points.map((q) => [...q]));
        } else {
          tileDiamond(g, VIEW, hover.x, hover.y);
        }
        g.strokeStyle = '#ff5f56';
        g.lineWidth = 2.5;
        g.stroke();
      } else {
        const p = palette.get(selected);
        if (p) {
          const at = snapOrigin(p.size, hover.x, hover.y);
          const ok = canPlace(palette, tiles, selected, at.x, at.y);
          g.globalAlpha = 0.65;
          drawStructure(g, p, at.x, at.y, VIEW, onSpriteReady, ok ? undefined : '#ff5f56');
          g.globalAlpha = 1;
        }
      }
    }
  }, [canvas, tiles, hover, selected, erasing, palette, theme, spriteTick, onSpriteReady]);

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
            width={VIEW.width}
            height={VIEW.height}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={() => { endDrag(); setHover(null); }}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={`Village grid, ${GRID} by ${GRID} tiles, ${stats.placed} structures placed`}
            className="block w-full max-w-[1040px] touch-none rounded-[10px] border border-line bg-panel-2"
            style={{ aspectRatio: `${VIEW.width} / ${VIEW.height}`, cursor: erasing ? 'not-allowed' : 'crosshair' }}
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
 * One structure: its footprint diamond, then its sprite standing on it.
 *
 * The sprite is scaled so its width matches the diamond's and anchored so its
 * bottom edge sits on the diamond's near corner — which is where the game
 * draws the ground line in this art. Anchoring by centre instead makes tall
 * buildings appear to float a tile behind where they actually are.
 */
function drawStructure(
  g: CanvasRenderingContext2D,
  p: PaletteEntry | undefined,
  tx: number, ty: number,
  iso: Iso,
  onSpriteReady: () => void,
  forceStroke?: string,
) {
  if (!p) return;
  const style = styleOf(p.category);
  const f = footprint(iso, tx, ty, p.size[0], p.size[1]);
  const alpha = g.globalAlpha;

  // The plate is what makes this a placement tool rather than a picture: it is
  // the only thing that says exactly which tiles are taken.
  trace(g, f.points.map((q) => [...q]));
  g.fillStyle = style.plate;
  g.fill();
  g.strokeStyle = forceStroke ?? style.edge;
  g.lineWidth = forceStroke ? 2.5 : 1.5;
  g.stroke();

  const img = sprite(p.id, onSpriteReady);
  if (img && img.naturalWidth > 0) {
    // Slightly narrower than the diamond. The art carries its own margin and
    // shadow, so drawing it at full width makes neighbours a tile apart look
    // like they are touching.
    const w = f.halfW * 2 * 0.94;
    const h = w * (img.naturalHeight / img.naturalWidth);
    g.drawImage(img, f.cx - w / 2, f.baseY - h, w, h);
    // Re-trace the outline over the art. The plate underneath is completely
    // hidden by the sprite, and without this there is no way to see which tiles
    // a structure actually occupies — which is the whole job of the tool.
    trace(g, f.points.map((q) => [...q]));
    g.strokeStyle = forceStroke ?? style.edge;
    g.globalAlpha *= forceStroke ? 1 : 0.35;
    g.lineWidth = forceStroke ? 2.5 : 1.25;
    g.stroke();
    g.globalAlpha = alpha;
    return;
  }

  // Sprite still loading, or missing: the vector icon keeps the board readable
  // instead of leaving a hole.
  const box = Math.min(f.halfW, f.halfH * 2) * 1.1;
  if (drawIcon(g, p.id, f.cx - box / 2, f.cy - box / 2, box, style.ink)) return;

  g.fillStyle = style.ink.accent;
  g.font = `700 ${Math.max(8, f.halfW * 0.5)}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(abbrev(p.name), f.cx, f.cy);
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
      <Image
        src={spriteUrl(entry.id)}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 object-contain"
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
