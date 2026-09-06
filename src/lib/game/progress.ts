import type { Building, Resource, Unit } from './types';
import { ALL_UNITS } from './army';
import { BUILDER_UNITS, type BuilderUnit } from './builder-base';

/**
 * Merge a player's API unit levels with the curated max-per-Town-Hall data.
 *
 * The API reports troop/spell/hero levels but nothing about buildings, so this
 * is the only progress view we can derive without the player recording their
 * village by hand in the planner.
 */

/** Loose match between API unit names and our dataset ("P.E.K.K.A" vs "pekka"). */
export const nameKey = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface UnitProgress {
  unit: Unit;
  id: string;
  name: string;
  kind: Unit['kind'];
  resource: Resource;
  level: number;
  maxHere: number;
  prevMax: number;
  pct: number;
  /** Behind the *previous* Town Hall's ceiling — the usual definition of rushed. */
  rushed: boolean;
  remainingCost: number;
  remainingHours: number;
  est: boolean;
  /** False when the account has not unlocked this unit at all. */
  found: boolean;
}

export interface PlayerUnitLevels {
  townHallLevel: number;
  heroes?: Array<{ name: string; level: number; village?: string }>;
  troops?: Array<{ name: string; level: number; village?: string }>;
  spells?: Array<{ name: string; level: number; village?: string }>;
}

export function analyseUnits(player: PlayerUnitLevels): UnitProgress[] {
  const th = player.townHallLevel;
  const levels = new Map<string, number>();

  for (const list of [player.heroes, player.troops, player.spells]) {
    for (const u of list ?? []) {
      if (u.village && u.village !== 'home') continue; // skip Builder Base
      levels.set(nameKey(u.name), u.level);
    }
  }

  return ALL_UNITS.filter((u) => u.max[th] > 0).map((u) => {
    const maxHere = u.max[th];
    const prevMax = th > 1 ? u.max[th - 1] : 0;
    const level = levels.get(nameKey(u.name)) ?? 0;

    let remainingCost = 0, remainingHours = 0, est = false;
    for (let l = level + 1; l <= maxHere; l++) {
      const step = u.levels[l];
      if (!step) continue;
      remainingCost += step.cost;
      remainingHours += step.hours;
      est ||= step.est;
    }

    return {
      unit: u, id: u.id, name: u.name, kind: u.kind, resource: u.resource,
      level, maxHere, prevMax,
      pct: maxHere ? (level / maxHere) * 100 : 0,
      rushed: prevMax > 0 && level < prevMax,
      remainingCost, remainingHours, est,
      found: levels.has(nameKey(u.name)),
    };
  });
}

export interface ProgressSummary {
  rows: UnitProgress[];
  /** Mean completion across every unit available at this Town Hall, 0-100. */
  overallPct: number;
  maxedCount: number;
  rushedCount: number;
  totalHours: number;
  cost: Record<Resource, number>;
  est: boolean;
}

export function summarise(rows: UnitProgress[]): ProgressSummary {
  const cost: Record<Resource, number> = { gold: 0, elixir: 0, dark: 0 };
  let totalHours = 0, est = false;

  for (const r of rows) {
    cost[r.resource] += r.remainingCost;
    totalHours += r.remainingHours;
    est ||= r.est;
  }

  const overallPct = rows.length
    ? (rows.reduce((a, r) => a + Math.min(1, r.level / Math.max(1, r.maxHere)), 0) / rows.length) * 100
    : 0;

  return {
    rows,
    overallPct,
    maxedCount: rows.filter((r) => r.maxHere > 0 && r.level >= r.maxHere).length,
    rushedCount: rows.filter((r) => r.rushed).length,
    totalHours,
    cost,
    est,
  };
}

/** Building-side equivalent, for a village recorded in the planner. */
export function buildingProgressPct(b: Building, buckets: Record<number, number>, th: number): number {
  const cap = b.max[th];
  const total = b.count[th];
  if (!cap || !total) return 100;
  const sum = Object.entries(buckets).reduce(
    (a, [lvl, n]) => a + Math.min(1, Number(lvl) / cap) * n, 0);
  return (sum / total) * 100;
}

/* ------------------------------------------------------------ Builder Base */

/**
 * The same progress question for the second village.
 *
 * Kept as a separate function rather than a flag on analyseUnits: the two
 * villages share no units, no currencies and no ceilings, and folding them
 * together is how a Builder Base level ends up counted against a Town Hall
 * maximum. There is no cost arithmetic here — see builder-base.ts for why.
 */
export interface BuilderUnitProgress {
  unit: BuilderUnit;
  id: string;
  name: string;
  kind: BuilderUnit['kind'];
  level: number;
  maxHere: number;
  prevMax: number;
  pct: number;
  rushed: boolean;
  found: boolean;
}

export interface BuilderProgressSummary {
  rows: BuilderUnitProgress[];
  overallPct: number;
  maxedCount: number;
  rushedCount: number;
}

export interface BuilderPlayerLevels {
  builderHallLevel?: number;
  heroes?: Array<{ name: string; level: number; village?: string }>;
  troops?: Array<{ name: string; level: number; village?: string }>;
}

export function analyseBuilderUnits(player: BuilderPlayerLevels): BuilderUnitProgress[] {
  const bh = player.builderHallLevel ?? 0;
  if (bh < 1) return [];

  const levels = new Map<string, number>();
  for (const list of [player.heroes, player.troops]) {
    for (const u of list ?? []) {
      // The inverse of the home-village filter: only the second village here.
      if (u.village !== 'builderBase') continue;
      levels.set(nameKey(u.name), u.level);
    }
  }

  return BUILDER_UNITS.filter((u) => u.max[bh] > 0).map((u) => {
    const maxHere = u.max[bh];
    const prevMax = bh > 1 ? u.max[bh - 1] : 0;
    const level = levels.get(nameKey(u.name)) ?? 0;

    return {
      unit: u, id: u.id, name: u.name, kind: u.kind,
      level, maxHere, prevMax,
      pct: maxHere ? (level / maxHere) * 100 : 0,
      rushed: prevMax > 0 && level < prevMax,
      found: levels.has(nameKey(u.name)),
    };
  });
}

export function summariseBuilder(rows: BuilderUnitProgress[]): BuilderProgressSummary {
  return {
    rows,
    overallPct: rows.length
      ? (rows.reduce((a, r) => a + Math.min(1, r.level / Math.max(1, r.maxHere)), 0) / rows.length) * 100
      : 0,
    maxedCount: rows.filter((r) => r.maxHere > 0 && r.level >= r.maxHere).length,
    rushedCount: rows.filter((r) => r.rushed).length,
  };
}
