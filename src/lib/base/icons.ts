/**
 * Structure icons and village terrain, drawn as vectors on a 2D context.
 *
 * These are original shapes, not Supercell art: the game's sprites are
 * copyrighted and this repository is public. The goal is recognisability at
 * ~20-90px — a cannon reads as a barrel on a base, a mortar as a bowl — not
 * fidelity to the real asset.
 *
 * Every icon draws inside the unit square. The caller translates to the tile
 * and scales, so one function serves both the 90px canvas footprint and the
 * 16px palette chip. That means all widths here are fractions: `0.06`, never
 * `2`, or a scaled-down icon comes out with hairline strokes.
 */

export interface Ink {
  /** Main mass of the structure. */
  body: string;
  /** Shadowed side, for a hint of volume. */
  shade: string;
  /** The one part the eye should land on: a barrel, a flame, a droplet. */
  accent: string;
  /** Outline, and any fine detail. */
  line: string;
}

export type IconDraw = (g: CanvasRenderingContext2D, ink: Ink) => void;

/* ------------------------------------------------------------- primitives */

const path = (g: CanvasRenderingContext2D, pts: number[][], close = true) => {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  if (close) g.closePath();
};

const fillPoly = (g: CanvasRenderingContext2D, pts: number[][], color: string) => {
  path(g, pts);
  g.fillStyle = color;
  g.fill();
};

const dot = (g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) => {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
};

const ring = (g: CanvasRenderingContext2D, x: number, y: number, r: number, w: number, color: string) => {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.strokeStyle = color;
  g.lineWidth = w;
  g.stroke();
};

const box = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
};

/** A squat plinth every ground structure sits on, so they share a silhouette. */
const plinth = (g: CanvasRenderingContext2D, ink: Ink) => {
  fillPoly(g, [[0.16, 0.74], [0.84, 0.74], [0.78, 0.88], [0.22, 0.88]], ink.shade);
};

/** Tapered tower body, used by everything with a vertical mass. */
const towerBody = (g: CanvasRenderingContext2D, ink: Ink, top = 0.32, bottom = 0.76) => {
  fillPoly(g, [[0.34, top], [0.66, top], [0.72, bottom], [0.28, bottom]], ink.body);
  fillPoly(g, [[0.5, top], [0.66, top], [0.72, bottom], [0.5, bottom]], ink.shade);
};

/** Crenellated cap — the shorthand that makes a shape read as "defence". */
const battlement = (g: CanvasRenderingContext2D, ink: Ink, y = 0.32, x0 = 0.3, x1 = 0.7) => {
  const w = (x1 - x0) / 5;
  box(g, x0, y, x1 - x0, w * 1.1, ink.accent);
  for (let i = 0; i < 3; i++) box(g, x0 + w * (i * 2), y - w, w, w * 1.2, ink.accent);
};

const roof = (g: CanvasRenderingContext2D, ink: Ink, peak = 0.12) => {
  fillPoly(g, [[0.5, peak], [0.78, 0.42], [0.22, 0.42]], ink.accent);
  fillPoly(g, [[0.5, peak], [0.78, 0.42], [0.5, 0.42]], ink.shade);
};

/* ----------------------------------------------------------------- icons */

const cannon: IconDraw = (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.26, 0.5], [0.62, 0.5], [0.66, 0.76], [0.22, 0.76]], ink.body);
  g.save();
  g.translate(0.56, 0.46);
  g.rotate(-0.42);
  box(g, 0, -0.11, 0.42, 0.22, ink.accent);
  box(g, 0.34, -0.14, 0.08, 0.28, ink.line);
  g.restore();
  dot(g, 0.44, 0.53, 0.06, ink.shade);
};

const archerTower: IconDraw = (g, ink) => {
  plinth(g, ink);
  towerBody(g, ink, 0.42, 0.78);
  roof(g, ink, 0.1);
  box(g, 0.44, 0.5, 0.12, 0.16, ink.line);
};

const multiArcherTower: IconDraw = (g, ink) => {
  plinth(g, ink);
  towerBody(g, ink, 0.46, 0.78);
  fillPoly(g, [[0.34, 0.14], [0.5, 0.4], [0.18, 0.4]], ink.accent);
  fillPoly(g, [[0.66, 0.14], [0.82, 0.4], [0.5, 0.4]], ink.accent);
  box(g, 0.45, 0.54, 0.1, 0.14, ink.line);
};

const mortar: IconDraw = (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.24, 0.52], [0.76, 0.52], [0.68, 0.78], [0.32, 0.78]], ink.body);
  g.beginPath();
  g.ellipse(0.5, 0.4, 0.24, 0.13, 0, 0, Math.PI * 2);
  g.fillStyle = ink.accent;
  g.fill();
  g.beginPath();
  g.ellipse(0.5, 0.39, 0.15, 0.08, 0, 0, Math.PI * 2);
  g.fillStyle = ink.line;
  g.fill();
};

const airDefense: IconDraw = (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.3, 0.54], [0.7, 0.54], [0.66, 0.78], [0.34, 0.78]], ink.body);
  for (const [x, r] of [[0.34, -0.3], [0.5, 0], [0.66, 0.3]] as const) {
    g.save();
    g.translate(x, 0.5);
    g.rotate(r);
    box(g, -0.055, -0.34, 0.11, 0.36, ink.accent);
    g.restore();
  }
};

const wizardTower: IconDraw = (g, ink) => {
  plinth(g, ink);
  towerBody(g, ink, 0.44, 0.78);
  fillPoly(g, [[0.5, 0.06], [0.76, 0.44], [0.24, 0.44]], ink.accent);
  // Orb bright-on-dark, not the reverse — under the roof it otherwise vanishes
  // and the tower is indistinguishable from an archer tower.
  dot(g, 0.5, 0.58, 0.11, ink.accent);
  dot(g, 0.5, 0.58, 0.05, ink.line);
};

const airSweeper: IconDraw = (g, ink) => {
  plinth(g, ink);
  towerBody(g, ink, 0.52, 0.78);
  g.save();
  g.translate(0.5, 0.36);
  for (let i = 0; i < 3; i++) {
    g.rotate((Math.PI * 2) / 3);
    fillPoly(g, [[0, 0], [0.1, -0.28], [-0.1, -0.28]], ink.accent);
  }
  g.restore();
  dot(g, 0.5, 0.36, 0.05, ink.line);
};

const hiddenTesla: IconDraw = (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.32, 0.46], [0.68, 0.46], [0.64, 0.78], [0.36, 0.78]], ink.body);
  ring(g, 0.5, 0.36, 0.15, 0.06, ink.line);
  fillPoly(g, [[0.53, 0.14], [0.42, 0.4], [0.5, 0.4], [0.45, 0.6], [0.6, 0.32], [0.51, 0.32]], ink.accent);
};

const bombTower: IconDraw = (g, ink) => {
  plinth(g, ink);
  towerBody(g, ink, 0.46, 0.78);
  dot(g, 0.5, 0.3, 0.17, ink.accent);
  g.beginPath();
  g.moveTo(0.58, 0.18);
  g.quadraticCurveTo(0.72, 0.1, 0.66, 0.02);
  g.strokeStyle = ink.line;
  g.lineWidth = 0.05;
  g.stroke();
};

const xbow: IconDraw = (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.32, 0.58], [0.68, 0.58], [0.64, 0.78], [0.36, 0.78]], ink.body);
  // Limbs plus a drawn string: an arc on its own reads as an umbrella.
  g.strokeStyle = ink.accent;
  g.lineWidth = 0.09;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0.13, 0.44);
  g.quadraticCurveTo(0.5, 0.18, 0.87, 0.44);
  g.stroke();
  g.lineCap = 'butt';
  g.strokeStyle = ink.line;
  g.lineWidth = 0.035;
  g.beginPath();
  g.moveTo(0.15, 0.45);
  g.lineTo(0.85, 0.45);
  g.stroke();
  box(g, 0.47, 0.18, 0.06, 0.4, ink.line);
  fillPoly(g, [[0.5, 0.08], [0.59, 0.26], [0.41, 0.26]], ink.accent);
};

const infernoTower: IconDraw = (g, ink) => {
  plinth(g, ink);
  towerBody(g, ink, 0.4, 0.78);
  g.beginPath();
  g.moveTo(0.5, 0.06);
  g.quadraticCurveTo(0.7, 0.26, 0.5, 0.4);
  g.quadraticCurveTo(0.3, 0.26, 0.5, 0.06);
  g.fillStyle = ink.accent;
  g.fill();
  dot(g, 0.5, 0.28, 0.05, ink.line);
};

const eagleArtillery: IconDraw = (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.22, 0.56], [0.78, 0.56], [0.72, 0.8], [0.28, 0.8]], ink.body);
  g.save();
  g.translate(0.5, 0.54);
  g.rotate(-0.6);
  box(g, -0.09, -0.44, 0.18, 0.46, ink.accent);
  box(g, -0.12, -0.48, 0.24, 0.1, ink.line);
  g.restore();
  fillPoly(g, [[0.2, 0.5], [0.34, 0.58], [0.2, 0.62]], ink.shade);
};

const scattershot: IconDraw = (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.26, 0.5], [0.74, 0.5], [0.66, 0.78], [0.34, 0.78]], ink.body);
  g.beginPath();
  g.ellipse(0.5, 0.42, 0.26, 0.12, 0, 0, Math.PI * 2);
  g.fillStyle = ink.accent;
  g.fill();
  for (const [x, y] of [[0.36, 0.24], [0.5, 0.16], [0.64, 0.24]]) dot(g, x, y, 0.055, ink.line);
};

const monolith: IconDraw = (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.36, 0.12], [0.64, 0.12], [0.7, 0.78], [0.3, 0.78]], ink.body);
  fillPoly(g, [[0.5, 0.12], [0.64, 0.12], [0.7, 0.78], [0.5, 0.78]], ink.shade);
  fillPoly(g, [[0.5, 0.26], [0.6, 0.44], [0.5, 0.62], [0.4, 0.44]], ink.accent);
};

const spellTower: IconDraw = (g, ink) => {
  plinth(g, ink);
  towerBody(g, ink, 0.42, 0.78);
  g.beginPath();
  g.arc(0.5, 0.28, 0.18, 0, Math.PI * 1.6);
  g.strokeStyle = ink.accent;
  g.lineWidth = 0.08;
  g.stroke();
  dot(g, 0.5, 0.28, 0.05, ink.line);
};

const ricochetCannon: IconDraw = (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.26, 0.52], [0.74, 0.52], [0.68, 0.78], [0.32, 0.78]], ink.body);
  for (const y of [0.34, 0.52]) box(g, 0.44, y - 0.07, 0.44, 0.13, ink.accent);
  box(g, 0.3, 0.28, 0.16, 0.34, ink.shade);
};

const multiGearTower: IconDraw = (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.3, 0.56], [0.7, 0.56], [0.66, 0.78], [0.34, 0.78]], ink.body);
  g.save();
  g.translate(0.5, 0.36);
  for (let i = 0; i < 8; i++) {
    g.rotate(Math.PI / 4);
    box(g, -0.045, -0.3, 0.09, 0.12, ink.accent);
  }
  g.restore();
  dot(g, 0.5, 0.36, 0.17, ink.accent);
  dot(g, 0.5, 0.36, 0.07, ink.line);
};

const firespitter: IconDraw = (g, ink) => {
  plinth(g, ink);
  towerBody(g, ink, 0.5, 0.78);
  g.save();
  g.translate(0.52, 0.44);
  g.rotate(-0.5);
  box(g, 0, -0.09, 0.34, 0.18, ink.shade);
  g.restore();
  for (const [x, y, r] of [[0.78, 0.2, 0.09], [0.66, 0.32, 0.06]]) dot(g, x, y, r, ink.accent);
};

const goldMine: IconDraw = (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.2, 0.44], [0.8, 0.44], [0.74, 0.78], [0.26, 0.78]], ink.body);
  fillPoly(g, [[0.5, 0.44], [0.8, 0.44], [0.74, 0.78], [0.5, 0.78]], ink.shade);
  for (const [x, y] of [[0.4, 0.6], [0.58, 0.56], [0.5, 0.7]]) dot(g, x, y, 0.075, ink.accent);
  fillPoly(g, [[0.5, 0.16], [0.66, 0.4], [0.34, 0.4]], ink.accent);
};

const elixirCollector: IconDraw = (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.28, 0.46], [0.72, 0.46], [0.68, 0.78], [0.32, 0.78]], ink.body);
  g.beginPath();
  g.moveTo(0.5, 0.08);
  g.bezierCurveTo(0.74, 0.3, 0.7, 0.44, 0.5, 0.44);
  g.bezierCurveTo(0.3, 0.44, 0.26, 0.3, 0.5, 0.08);
  g.fillStyle = ink.accent;
  g.fill();
  dot(g, 0.43, 0.31, 0.045, ink.line);
};

const darkDrill: IconDraw = (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.28, 0.5], [0.72, 0.5], [0.68, 0.78], [0.32, 0.78]], ink.body);
  fillPoly(g, [[0.5, 0.08], [0.64, 0.5], [0.36, 0.5]], ink.accent);
  g.strokeStyle = ink.line;
  g.lineWidth = 0.04;
  for (const y of [0.24, 0.34, 0.44]) {
    g.beginPath();
    g.moveTo(0.5 - (y - 0.08) * 0.33, y);
    g.lineTo(0.5 + (y - 0.08) * 0.33, y);
    g.stroke();
  }
};

/** Storages share a silhouette and separate by accent colour. */
const storage = (band: 'coin' | 'drop' | 'skull'): IconDraw => (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.22, 0.3], [0.78, 0.3], [0.72, 0.8], [0.28, 0.8]], ink.body);
  fillPoly(g, [[0.5, 0.3], [0.78, 0.3], [0.72, 0.8], [0.5, 0.8]], ink.shade);
  box(g, 0.2, 0.24, 0.6, 0.09, ink.line);
  if (band === 'coin') {
    dot(g, 0.5, 0.56, 0.13, ink.accent);
    dot(g, 0.5, 0.56, 0.06, ink.line);
  } else if (band === 'drop') {
    g.beginPath();
    g.moveTo(0.5, 0.4);
    g.bezierCurveTo(0.68, 0.58, 0.64, 0.7, 0.5, 0.7);
    g.bezierCurveTo(0.36, 0.7, 0.32, 0.58, 0.5, 0.4);
    g.fillStyle = ink.accent;
    g.fill();
  } else {
    dot(g, 0.5, 0.54, 0.13, ink.accent);
    dot(g, 0.45, 0.52, 0.035, ink.line);
    dot(g, 0.55, 0.52, 0.035, ink.line);
    box(g, 0.44, 0.62, 0.12, 0.06, ink.line);
  }
};

const armyCamp: IconDraw = (g, ink) => {
  fillPoly(g, [[0.5, 0.16], [0.86, 0.8], [0.14, 0.8]], ink.body);
  fillPoly(g, [[0.5, 0.16], [0.86, 0.8], [0.5, 0.8]], ink.shade);
  fillPoly(g, [[0.5, 0.42], [0.62, 0.8], [0.38, 0.8]], ink.accent);
  box(g, 0.48, 0.06, 0.04, 0.14, ink.line);
};

const barracks = (dark: boolean): IconDraw => (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.2, 0.36], [0.8, 0.36], [0.76, 0.78], [0.24, 0.78]], ink.body);
  fillPoly(g, [[0.5, 0.36], [0.8, 0.36], [0.76, 0.78], [0.5, 0.78]], ink.shade);
  battlement(g, ink, 0.32, 0.18, 0.82);
  if (dark) {
    dot(g, 0.5, 0.58, 0.1, ink.accent);
  } else {
    fillPoly(g, [[0.5, 0.46], [0.57, 0.62], [0.5, 0.72], [0.43, 0.62]], ink.accent);
  }
};

const laboratory: IconDraw = (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.24, 0.4], [0.76, 0.4], [0.72, 0.78], [0.28, 0.78]], ink.body);
  fillPoly(g, [[0.44, 0.12], [0.56, 0.12], [0.56, 0.34], [0.68, 0.62], [0.32, 0.62]], ink.accent);
  dot(g, 0.44, 0.54, 0.04, ink.line);
  dot(g, 0.56, 0.5, 0.03, ink.line);
};

const factory = (dark: boolean): IconDraw => (g, ink) => {
  plinth(g, ink);
  g.beginPath();
  g.arc(0.5, 0.56, 0.26, Math.PI, 0, true);
  g.closePath();
  g.fillStyle = ink.body;
  g.fill();
  box(g, 0.2, 0.5, 0.6, 0.08, ink.shade);
  for (const [x, y, r] of [[0.42, 0.34, 0.07], [0.6, 0.28, 0.05], [0.5, 0.2, 0.04]]) {
    dot(g, x, y, r, dark ? ink.line : ink.accent);
  }
};

const workshop: IconDraw = (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.22, 0.38], [0.78, 0.38], [0.74, 0.78], [0.26, 0.78]], ink.body);
  fillPoly(g, [[0.3, 0.5], [0.7, 0.5], [0.62, 0.66], [0.38, 0.66]], ink.accent);
  box(g, 0.44, 0.62, 0.12, 0.12, ink.shade);
  box(g, 0.3, 0.2, 0.1, 0.2, ink.line);
};

const petHouse: IconDraw = (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.22, 0.4], [0.78, 0.4], [0.74, 0.78], [0.26, 0.78]], ink.body);
  roof(g, ink, 0.14);
  dot(g, 0.5, 0.62, 0.1, ink.accent);
  for (const [x, y] of [[0.38, 0.5], [0.5, 0.46], [0.62, 0.5]]) dot(g, x, y, 0.045, ink.accent);
};

const blacksmith: IconDraw = (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.22, 0.4], [0.78, 0.4], [0.74, 0.78], [0.26, 0.78]], ink.body);
  g.save();
  g.translate(0.5, 0.58);
  g.rotate(-0.6);
  box(g, -0.04, -0.26, 0.08, 0.4, ink.line);
  box(g, -0.18, -0.3, 0.36, 0.14, ink.accent);
  g.restore();
};

const clanCastle: IconDraw = (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.24, 0.34], [0.76, 0.34], [0.72, 0.78], [0.28, 0.78]], ink.body);
  fillPoly(g, [[0.5, 0.34], [0.76, 0.34], [0.72, 0.78], [0.5, 0.78]], ink.shade);
  battlement(g, ink, 0.3, 0.22, 0.78);
  box(g, 0.16, 0.42, 0.13, 0.36, ink.body);
  box(g, 0.71, 0.42, 0.13, 0.36, ink.shade);
  fillPoly(g, [[0.42, 0.78], [0.42, 0.6], [0.5, 0.52], [0.58, 0.6], [0.58, 0.78]], ink.line);
};

const buildersHut: IconDraw = (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.26, 0.42], [0.74, 0.42], [0.7, 0.78], [0.3, 0.78]], ink.body);
  roof(g, ink, 0.14);
  g.save();
  g.translate(0.5, 0.6);
  g.rotate(0.5);
  box(g, -0.035, -0.16, 0.07, 0.3, ink.line);
  box(g, -0.15, -0.22, 0.3, 0.11, ink.accent);
  g.restore();
};

const townHall: IconDraw = (g, ink) => {
  plinth(g, ink);
  fillPoly(g, [[0.2, 0.38], [0.8, 0.38], [0.76, 0.8], [0.24, 0.8]], ink.body);
  fillPoly(g, [[0.5, 0.38], [0.8, 0.38], [0.76, 0.8], [0.5, 0.8]], ink.shade);
  fillPoly(g, [[0.5, 0.08], [0.88, 0.38], [0.12, 0.38]], ink.accent);
  fillPoly(g, [[0.5, 0.08], [0.88, 0.38], [0.5, 0.38]], ink.line);
  box(g, 0.42, 0.56, 0.16, 0.24, ink.line);
  box(g, 0.48, 0.0, 0.04, 0.12, ink.line);
  fillPoly(g, [[0.52, 0.0], [0.72, 0.05], [0.52, 0.1]], ink.accent);
};

/* ----------------------------------------------------------------- traps */

const bomb: IconDraw = (g, ink) => {
  dot(g, 0.5, 0.6, 0.28, ink.body);
  dot(g, 0.42, 0.52, 0.09, ink.shade);
  box(g, 0.44, 0.26, 0.12, 0.1, ink.line);
  g.beginPath();
  g.moveTo(0.56, 0.28);
  g.quadraticCurveTo(0.76, 0.2, 0.7, 0.06);
  g.strokeStyle = ink.accent;
  g.lineWidth = 0.07;
  g.stroke();
};

const giantBomb: IconDraw = (g, ink) => {
  dot(g, 0.5, 0.58, 0.34, ink.body);
  dot(g, 0.4, 0.48, 0.12, ink.shade);
  box(g, 0.42, 0.18, 0.16, 0.12, ink.line);
  dot(g, 0.66, 0.14, 0.09, ink.accent);
};

const springTrap: IconDraw = (g, ink) => {
  box(g, 0.24, 0.74, 0.52, 0.12, ink.shade);
  g.strokeStyle = ink.accent;
  g.lineWidth = 0.09;
  g.beginPath();
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    g.lineTo(0.5 + Math.sin(t * Math.PI * 4) * 0.2, 0.74 - t * 0.5);
  }
  g.stroke();
  box(g, 0.3, 0.1, 0.4, 0.1, ink.line);
};

const airBomb: IconDraw = (g, ink) => {
  dot(g, 0.5, 0.5, 0.24, ink.body);
  fillPoly(g, [[0.5, 0.74], [0.66, 0.94], [0.34, 0.94]], ink.accent);
  box(g, 0.44, 0.18, 0.12, 0.12, ink.line);
  dot(g, 0.42, 0.42, 0.07, ink.shade);
};

const seekingAirMine: IconDraw = (g, ink) => {
  dot(g, 0.5, 0.52, 0.26, ink.body);
  for (let i = 0; i < 8; i++) {
    g.save();
    g.translate(0.5, 0.52);
    g.rotate((i * Math.PI) / 4);
    fillPoly(g, [[0, -0.26], [0.06, -0.4], [-0.06, -0.4]], ink.accent);
    g.restore();
  }
  dot(g, 0.5, 0.52, 0.09, ink.line);
};

const skeletonTrap: IconDraw = (g, ink) => {
  dot(g, 0.5, 0.44, 0.26, ink.body);
  dot(g, 0.41, 0.42, 0.07, ink.line);
  dot(g, 0.59, 0.42, 0.07, ink.line);
  fillPoly(g, [[0.34, 0.62], [0.66, 0.62], [0.62, 0.82], [0.38, 0.82]], ink.accent);
  for (const x of [0.44, 0.5, 0.56]) box(g, x - 0.015, 0.62, 0.03, 0.2, ink.line);
};

const tornadoTrap: IconDraw = (g, ink) => {
  g.strokeStyle = ink.accent;
  g.lineCap = 'round';
  for (const [y, w, lw] of [[0.24, 0.3, 0.09], [0.42, 0.22, 0.08], [0.58, 0.14, 0.07], [0.72, 0.07, 0.06]]) {
    g.lineWidth = lw;
    g.beginPath();
    g.moveTo(0.5 - w, y);
    g.lineTo(0.5 + w, y);
    g.stroke();
  }
  g.lineCap = 'butt';
};

/* --------------------------------------------------------------- registry */

export const ICONS: Record<string, IconDraw> = {
  cannon,
  archer_tower: archerTower,
  multi_archer_tower: multiArcherTower,
  mortar,
  air_defense: airDefense,
  wizard_tower: wizardTower,
  air_sweeper: airSweeper,
  hidden_tesla: hiddenTesla,
  bomb_tower: bombTower,
  xbow,
  inferno_tower: infernoTower,
  eagle_artillery: eagleArtillery,
  scattershot,
  monolith,
  spell_tower: spellTower,
  ricochet_cannon: ricochetCannon,
  multi_gear_tower: multiGearTower,
  firespitter,
  gold_mine: goldMine,
  elixir_collector: elixirCollector,
  dark_drill: darkDrill,
  gold_storage: storage('coin'),
  elixir_storage: storage('drop'),
  dark_storage: storage('skull'),
  army_camp: armyCamp,
  barracks: barracks(false),
  dark_barracks: barracks(true),
  laboratory,
  spell_factory: factory(false),
  dark_spell_factory: factory(true),
  workshop,
  pet_house: petHouse,
  blacksmith,
  clan_castle: clanCastle,
  builders_hut: buildersHut,
  bomb,
  giant_bomb: giantBomb,
  spring_trap: springTrap,
  air_bomb: airBomb,
  seeking_air_mine: seekingAirMine,
  skeleton_trap: skeletonTrap,
  tornado_trap: tornadoTrap,
  __townhall: townHall,
};

/**
 * Draw an icon into a box, or return false when the id has none — the caller
 * then falls back to the lettered tile, so a building added to the table
 * without an icon still renders something readable.
 */
export function drawIcon(
  g: CanvasRenderingContext2D,
  id: string,
  x: number, y: number, size: number,
  ink: Ink,
): boolean {
  const icon = ICONS[id];
  if (!icon) return false;
  g.save();
  g.translate(x, y);
  g.scale(size, size);
  icon(g, ink);
  g.restore();
  return true;
}
