'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  GRID, HALL_ID, abbrev, canPlace, countOf, eraseAt, paletteFor,
  lineTiles, paletteIndex, place, sanitise, snapOrigin, statsFor,
  type BaseLayout, type Palette, type PaletteCategory, type PaletteEntry, type Tile,
} from '@/lib/base/layout';
import { drawIcon, type Ink } from '@/lib/base/icons';
import { TERRAIN, paintTerrain } from '@/lib/base/terrain';
import {
  depth, footprint, initialCamera, isoCanvas, panBy, toLayer, toTile, tileDiamond,
  trace, viewport, zoomAt, MAX_SCALE, MIN_SCALE, type Camera, type Iso,
} from '@/lib/base/iso';
import { buildingSprite, buildingSpriteUrl } from '@/lib/sprites';
import { MAX_TH } from '@/lib/game/town-halls';
import { MAX_BH } from '@/lib/game/builder-base';
import { useVillageState } from '@/lib/store';
import type { VillageId } from '@/lib/game/types';
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

export function BaseBuilder({ village }: { village: VillageId }) {
  const { state, setState, loaded } = useVillageState(village);
  const theme = useResolvedTheme();
  const th = state.hall;
  const hallId = HALL_ID[village];
  const hallName = village === 'builder' ? 'Builder Hall' : 'Town Hall';
  const hallShort = village === 'builder' ? 'BH' : 'TH';
  const maxHall = village === 'builder' ? MAX_BH : MAX_TH;

  const entries = useMemo(() => paletteFor(th, village), [th, village]);
  const palette = useMemo(() => paletteIndex(entries), [entries]);

  const [tiles, setTiles] = useState<Tile[]>([]);
  const [history, setHistory] = useState<Tile[][]>([]);
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string>(hallId);
  const [erasing, setErasing] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [cam, setCam] = useState<Camera>(() => initialCamera(VIEW.width, VIEW.height));
  /**
   * A structure picked up by dragging it. `grab` is the offset from the
   * structure's origin to the tile grabbed, so it does not jump to the cursor
   * the moment you touch it.
   */
  const [moving, setMoving] = useState<
    { tile: Tile; grab: { x: number; y: number }; at: { x: number; y: number } } | null
  >(null);

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
    // Screen -> canvas backing -> (through the camera) layer -> isometric tile.
    const p = toLayer(
      cam, VIEW.width, VIEW.height,
      ((clientX - r.left) / r.width) * VIEW.width,
      ((clientY - r.top) / r.height) * VIEW.height,
    );
    return toTile(VIEW, p.x, p.y, GRID);
  }, [canvas, cam]);

  /** Canvas-backing pixels for a client point, for camera maths. */
  const backingAt = useCallback((clientX: number, clientY: number) => {
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * VIEW.width,
      y: ((clientY - r.top) / r.height) * VIEW.height,
    };
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

  /** Middle-button or shift-drag pans, the way map editors do. */
  const panning = useRef<{ x: number; y: number } | null>(null);

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    if (e.button === 1 || e.shiftKey) {
      panning.current = { x: e.clientX, y: e.clientY };
      return;
    }

    dragging.current = true;
    const t = tileAt(e.clientX, e.clientY);
    if (!t) return;
    lastPainted.current = t;

    const erase = erasing || e.button === 2;
    if (!erase) {
      // Dragging something already on the board moves it, the way it works in
      // the game. Only empty ground places a new structure — otherwise every
      // attempt to nudge a building drops another one on top of it.
      const under = topAt(palette, tiles, t.x, t.y);
      if (under) {
        setMoving({
          tile: under,
          grab: { x: t.x - under.x, y: t.y - under.y },
          at: { x: under.x, y: under.y },
        });
        return;
      }
    }
    apply(t.x, t.y, erase);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (panning.current) {
      const r = e.currentTarget.getBoundingClientRect();
      const k = VIEW.width / r.width;
      // The delta is resolved here, not inside the updater. React may run an
      // updater later than the event that queued it — by which time pointerup
      // has set `panning.current` to null and reading it would throw.
      const dx = (e.clientX - panning.current.x) * k;
      const dy = (e.clientY - panning.current.y) * k;
      panning.current = { x: e.clientX, y: e.clientY };
      setCam((c) => panBy(c, VIEW.width, VIEW.height, dx, dy));
      return;
    }

    const t = tileAt(e.clientX, e.clientY);
    const moved = !hover || !t || hover.x !== t.x || hover.y !== t.y;
    if (moved) setHover(t);

    if (moving) {
      if (t && moved) {
        setMoving((m) => (m ? { ...m, at: { x: t.x - m.grab.x, y: t.y - m.grab.y } } : m));
      }
      return;
    }

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

  /** Drop a structure being moved, if where it landed is legal. */
  function finishMove() {
    if (!moving) return;
    const { tile, at } = moving;
    setMoving(null);
    if (at.x === tile.x && at.y === tile.y) return;
    const without = tiles.filter((t) => t !== tile);
    if (canPlace(palette, without, tile.id, at.x, at.y)) {
      commit([...without, { id: tile.id, x: at.x, y: at.y }]);
    }
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    const b = backingAt(e.clientX, e.clientY);
    if (!b) return;
    setCam((c) => zoomAt(c, VIEW.width, VIEW.height, b.x, b.y, e.deltaY < 0 ? 1.15 : 1 / 1.15));
  }

  const endDrag = () => {
    finishMove();
    panning.current = null;
    dragging.current = false;
    lastPainted.current = null;
  };

  /* ------------------------------------------------------------- drawing */

  /**
   * Sprites arrive asynchronously, so a load has to invalidate the cached
   * structure layer and force a repaint — otherwise the board keeps showing
   * the vector fallback until something else happens to change.
   */
  const [spriteTick, setSpriteTick] = useState(0);
  const onSpriteReady = useCallback(() => setSpriteTick((t) => t + 1), []);

  /**
   * Terrain is cached, structures are not.
   *
   * Terrain is thousands of diamonds and scattered scenery, it never changes
   * while you build, and it is texture — magnifying the cached copy when zoomed
   * costs nothing anyone can see. Structures are the opposite: a few hundred
   * drawImage calls, cheap to repeat, and the whole reason to zoom in is to
   * look at them closely. Drawing them live means the sprite is rasterised at
   * the size it is displayed, so zooming sharpens them instead of blurring a
   * cached bitmap.
   */
  const terrainLayer = useRef<{ theme: string; c: HTMLCanvasElement } | null>(null);

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

    // Zoom and pan are a crop of the terrain, not a repaint of it.
    const v = viewport(cam, VIEW.width, VIEW.height);
    g.clearRect(0, 0, VIEW.width, VIEW.height);
    if (terrainLayer.current) {
      g.drawImage(terrainLayer.current.c, v.sx, v.sy, v.sw, v.sh, 0, 0, VIEW.width, VIEW.height);
    }

    // Everything else is drawn in layer coordinates under the camera transform.
    g.save();
    g.scale(VIEW.width / v.sw, VIEW.height / v.sh);
    g.translate(-v.sx, -v.sy);

    // Painter's algorithm: back to front, or a Town Hall swallows the wall
    // standing in front of it.
    const order = [...tiles].sort((a, b) => {
      const pa = palette.get(a.id), pb = palette.get(b.id);
      if (!pa || !pb) return 0;
      return depth(a.x, a.y, pa.size[0], pa.size[1]) - depth(b.x, b.y, pb.size[0], pb.size[1]);
    });
    for (const t of order) {
      if (moving && t === moving.tile) continue;
      drawStructure(g, palette.get(t.id), t.x, t.y, VIEW, onSpriteReady, village);
    }

    if (moving) {
      const p = palette.get(moving.tile.id);
      if (p) {
        const without = tiles.filter((t) => t !== moving.tile);
        const ok = canPlace(palette, without, moving.tile.id, moving.at.x, moving.at.y);
        g.globalAlpha = 0.75;
        drawStructure(g, p, moving.at.x, moving.at.y, VIEW, onSpriteReady, village, ok ? undefined : '#ff5f56');
        g.globalAlpha = 1;
      }
    } else if (hover) {
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
          drawStructure(g, p, at.x, at.y, VIEW, onSpriteReady, village, ok ? undefined : '#ff5f56');
          g.globalAlpha = 1;
        }
      }
    }
    g.restore();
  }, [canvas, tiles, hover, selected, erasing, palette, theme, spriteTick, onSpriteReady, cam, moving, village]);

  /* --------------------------------------------------------- persistence */

  const layouts = state.layouts;

  function save() {
    const label = name.trim() || `${hallShort}${th} layout`;
    const id = layoutId ?? `ly_${Date.now().toString(36)}`;
    const record: BaseLayout = {
      id, name: label, hall: th, village, tiles, updated: new Date().toISOString(),
    };
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
    // Always filtered, never trusted — including when the layout's own hall
    // matches this one. Layouts live in localStorage and can be edited by
    // hand, so `l.hall` is a claim, not a guarantee: a layout tagged TH3
    // holding TH14 structures would otherwise load them all and report "110
    // placed of 77 available".
    const kept = sanitise(palette, l.tiles);
    const dropped = l.tiles.length - kept.length;
    commit(kept);
    setLayoutId(l.id);
    setName(l.name);
    setNote(dropped === 0 ? null
      : l.hall === th
        ? `${dropped} structures ${hallShort}${th} cannot build were dropped.`
        : `Built for ${hallShort}${l.hall}: ${dropped} structures ${hallShort}${th} cannot build were dropped.`);
  }

  function remove(id: string) {
    setState((s) => ({ layouts: s.layouts.filter((l) => l.id !== id) }));
    if (layoutId === id) setLayoutId(null);
  }

  function changeHall(next: number) {
    const kept = sanitise(paletteIndex(paletteFor(next, village)), tiles);
    setState({ hall: next });
    commit(kept);
    setNote(kept.length < tiles.length
      ? `${tiles.length - kept.length} structures dropped — ${hallShort}${next} cannot build them.`
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
            <Toolbtn
              onClick={() => setCam((c) => zoomAt(c, VIEW.width, VIEW.height, VIEW.width / 2, VIEW.height / 2, 1 / 1.4))}
              disabled={cam.scale <= MIN_SCALE}
            >
              −
            </Toolbtn>
            <span className="num w-10 text-center text-[11px] text-faint">{cam.scale.toFixed(1)}×</span>
            <Toolbtn
              onClick={() => setCam((c) => zoomAt(c, VIEW.width, VIEW.height, VIEW.width / 2, VIEW.height / 2, 1.4))}
              disabled={cam.scale >= MAX_SCALE}
            >
              +
            </Toolbtn>
            <Toolbtn
              onClick={() => setCam(initialCamera(VIEW.width, VIEW.height))}
              disabled={cam.scale === MIN_SCALE}
            >
              Fit
            </Toolbtn>
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
          <Stat label={hallName} value={stats.hasHall ? 'placed' : 'missing'}
            tone={stats.hasHall ? 'ok' : 'bad'} />
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
            onWheel={onWheel}
            onPointerLeave={() => { endDrag(); setHover(null); }}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={`Village grid, ${GRID} by ${GRID} tiles, ${stats.placed} structures placed`}
            className="block w-full max-w-[1040px] touch-none rounded-[10px] border border-line bg-panel-2"
            style={{ aspectRatio: `${VIEW.width} / ${VIEW.height}`, cursor: erasing ? 'not-allowed' : 'crosshair' }}
          />
        </div>
        <p className="mt-3 text-center text-[12px] text-faint">
          Click to place · drag a structure to move it · drag to paint walls and traps
          <br />
          Right-click to remove · scroll to zoom · shift-drag or middle-drag to pan
        </p>
      </Panel>

      <div className="grid gap-4">
        <Panel title={hallName} action={<span className="num text-[13px] text-gold">{hallShort}{th}</span>}>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            Placement limits for
            <select
              value={th}
              onChange={(e) => changeHall(Number(e.target.value))}
              className="num rounded-md border border-line bg-panel-2 px-2 py-1 text-text outline-none focus:border-gold/50"
            >
              {Array.from({ length: maxHall }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{hallShort}{n}</option>
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
                village={village}
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
                  <div className="num text-[11px] text-faint">{hallShort}{l.hall} · {l.tiles.length} structures</div>
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
  village: VillageId,
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

  const img = buildingSprite(p.id, p.level, onSpriteReady, village);
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

/** The structure's own art at the level this hall reaches. */
function SpriteChip({ entry, village }: { entry: PaletteEntry; village: VillageId }) {
  const url = buildingSpriteUrl(entry.id, entry.level, village);
  if (!url) {
    const col = styleOf(entry.category);
    return (
      <span
        className="h-7 w-7 shrink-0 rounded-[4px] border"
        style={{ background: col.plate, borderColor: col.edge }}
      />
    );
  }
  return (
    <Image
      src={url}
      alt=""
      width={28}
      height={28}
      className="h-7 w-7 shrink-0 object-contain"
    />
  );
}

function PaletteRow({ entry, used, active, onSelect, village }: {
  entry: PaletteEntry; used: number; active: boolean; onSelect: () => void; village: VillageId;
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
      <SpriteChip entry={entry} village={village} />
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
