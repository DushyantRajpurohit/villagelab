import { and, desc, eq, ne } from 'drizzle-orm';
import { db, hasDatabase, schema } from '../db';
import { mockWar, mockWarLog } from '../coc/mock';
import { isValidTag, normalizeTag } from '../coc/tags';
import { analyseWar, normaliseWarLog, summariseWarLog } from '../war/analyse';
import type { WarAnalysis, WarLogEntry, WarLogSummary, WarMemberRow, WarState } from '../war/types';
import { enqueue } from './players';

/**
 * Read path for the war room. Like players and clans, it only ever reads
 * Postgres — the ingestion worker is the sole caller of the Supercell API.
 */

/** The slice of an opponent we keep: enough to draw the matchup, nothing more. */
export interface OpponentSlot {
  tag: string;
  name: string;
  th: number;
  pos: number;
}

export type WarResult =
  | { status: 'ok'; war: WarAnalysis; mock: boolean; fetchedAt: Date | null }
  | { status: 'none' }
  | { status: 'queued' }
  | { status: 'invalid' };

export type WarLogResult =
  | { status: 'ok'; entries: WarLogEntry[]; summary: WarLogSummary; mock: boolean }
  | { status: 'empty' }
  | { status: 'queued' }
  | { status: 'invalid' };

const HISTORY_LIMIT = 25;

export async function getCurrentWar(rawTag: string): Promise<WarResult> {
  const tag = normalizeTag(rawTag);
  if (!isValidTag(tag)) return { status: 'invalid' };

  if (!hasDatabase) {
    return { status: 'ok', mock: true, fetchedAt: new Date(), war: analyseWar(mockWar(tag)) };
  }

  const [row] = await db()
    .select()
    .from(schema.wars)
    .where(and(eq(schema.wars.clanTag, tag), ne(schema.wars.state, 'warEnded')))
    .orderBy(desc(schema.wars.endTime))
    .limit(1);

  if (!row) {
    // No live war held. Ask for one; the clan may simply not be in a war.
    await enqueue(tag, 'war');
    const [any] = await db()
      .select({ id: schema.wars.id })
      .from(schema.wars)
      .where(eq(schema.wars.clanTag, tag))
      .limit(1);
    return any ? { status: 'none' } : { status: 'queued' };
  }

  const rows = await db()
    .select()
    .from(schema.warAttacks)
    .where(eq(schema.warAttacks.warId, row.id))
    .orderBy(schema.warAttacks.mapPosition);

  return { status: 'ok', mock: false, fetchedAt: row.fetchedAt, war: fromRows(row, rows) };
}

type WarRow = typeof schema.wars.$inferSelect;
type AttackRow = typeof schema.warAttacks.$inferSelect;

/**
 * Rebuild the view model from stored rows.
 *
 * The worker folds each member's attacks down to a single row before writing,
 * so the per-attack detail is gone by now — which is deliberate: a 50v50 war
 * would otherwise be 100 attack rows per fetch, every fetch, forever.
 */
function fromRows(row: WarRow, attacks: AttackRow[]): WarAnalysis {
  const rows: WarMemberRow[] = attacks.map((a) => ({
    tag: a.playerTag,
    name: a.name,
    townHallLevel: a.townHallLevel,
    mapPosition: a.mapPosition,
    attacksUsed: a.attacksUsed,
    attacksAllowed: a.attacksAllowed,
    unused: Math.max(0, a.attacksAllowed - a.attacksUsed),
    stars: a.stars,
    bestDestruction: a.destruction,
    defenseStars: a.defenseStars,
    defenseDestruction: a.defenseDestruction,
  }));

  const opponents = JSON.parse(row.opponentRoster) as OpponentSlot[];
  const missing = rows
    .filter((r) => r.unused > 0)
    .sort((a, b) => b.unused - a.unused || a.mapPosition - b.mapPosition);

  const ahead = row.stars !== row.opponentStars
    ? row.stars > row.opponentStars
    : row.destruction !== row.opponentDestruction
      ? row.destruction > row.opponentDestruction
      : null;

  return {
    state: row.state as WarState,
    teamSize: row.teamSize,
    attacksPerMember: row.attacksPerMember,
    startTime: row.startTime?.toISOString() ?? null,
    endTime: row.endTime.toISOString(),
    us: {
      tag: row.clanTag, name: '', stars: row.stars, destruction: row.destruction,
      spread: countTh(rows.map((r) => r.townHallLevel)),
    },
    them: {
      tag: row.opponentTag, name: row.opponentName ?? 'Opponent',
      stars: row.opponentStars, destruction: row.opponentDestruction,
      spread: countTh(opponents.map((o) => o.th)),
    },
    standing: ahead === null ? 'level' : ahead ? 'ahead' : 'behind',
    maxStars: row.teamSize * 3,
    attacksUsed: rows.reduce((a, r) => a + r.attacksUsed, 0),
    attacksTotal: row.teamSize * row.attacksPerMember,
    rows,
    missing,
    outstanding: missing.reduce((a, r) => a + r.unused, 0),
  };
}

function countTh(levels: number[]): Array<[number, number]> {
  const counts = new Map<number, number>();
  for (const th of levels) counts.set(th, (counts.get(th) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[0] - a[0]);
}

export async function getWarLog(rawTag: string): Promise<WarLogResult> {
  const tag = normalizeTag(rawTag);
  if (!isValidTag(tag)) return { status: 'invalid' };

  if (!hasDatabase) {
    const entries = normaliseWarLog(mockWarLog(tag, HISTORY_LIMIT));
    return { status: 'ok', mock: true, entries, summary: summariseWarLog(entries) };
  }

  const rows = await db()
    .select()
    .from(schema.wars)
    .where(and(eq(schema.wars.clanTag, tag), eq(schema.wars.state, 'warEnded')))
    .orderBy(desc(schema.wars.endTime))
    .limit(HISTORY_LIMIT);

  if (!rows.length) {
    await enqueue(tag, 'war');
    return { status: 'queued' };
  }

  const entries: WarLogEntry[] = rows.map((r) => ({
    result: (r.result ?? 'tie') as WarLogEntry['result'],
    endTime: r.endTime.toISOString(),
    teamSize: r.teamSize,
    opponentTag: r.opponentTag,
    opponentName: r.opponentName ?? 'Unknown',
    stars: r.stars,
    opponentStars: r.opponentStars,
    destruction: r.destruction,
    opponentDestruction: r.opponentDestruction,
  }));

  return { status: 'ok', mock: false, entries, summary: summariseWarLog(entries) };
}
