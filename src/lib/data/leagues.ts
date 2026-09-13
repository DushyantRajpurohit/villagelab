import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, hasDatabase, schema } from '../db';
import { mockLeague } from '../coc/mock';
import { isValidTag, normalizeTag } from '../coc/tags';
import { analyseLeague, recordLeagueWar, roundOfWar, scheduledTags } from '../war/league';
import type {
  LeagueAnalysis, LeagueSide, LeagueState, LeagueWarRecord, RawLeagueGroup, WarState,
} from '../war/types';
import { enqueue } from './players';

/**
 * Read path for the war league. Same contract as every other read path: only
 * Postgres, never Supercell.
 */

export type LeagueResult =
  | { status: 'ok'; league: LeagueAnalysis; mock: boolean; fetchedAt: Date | null }
  | { status: 'none' }
  | { status: 'queued' }
  | { status: 'invalid' };

export async function getLeague(rawTag: string): Promise<LeagueResult> {
  const tag = normalizeTag(rawTag);
  if (!isValidTag(tag)) return { status: 'invalid' };

  if (!hasDatabase) {
    const { group, wars } = mockLeague(tag);
    const records = Object.entries(wars)
      .map(([warTag, w]) => recordLeagueWar(w, warTag, roundOfWar(group, warTag)));
    return { status: 'ok', mock: true, fetchedAt: new Date(), league: analyseLeague(tag, group, records) };
  }

  // Seasons are `YYYY-MM`, so the latest sorts last as a string.
  const [row] = await db()
    .select()
    .from(schema.leagueGroups)
    .where(eq(schema.leagueGroups.clanTag, tag))
    .orderBy(desc(schema.leagueGroups.season))
    .limit(1);

  if (!row) {
    // No group held. Most of the month that simply means no league is running,
    // so tell "we have looked and there is none" apart from "never looked": a
    // job the worker has run is rescheduled into the future.
    const [job] = await db()
      .select({ next: schema.fetchQueue.nextFetchAt })
      .from(schema.fetchQueue)
      .where(and(eq(schema.fetchQueue.tag, tag), eq(schema.fetchQueue.kind, 'league')))
      .limit(1);
    await enqueue(tag, 'league');
    return job && job.next > new Date() ? { status: 'none' } : { status: 'queued' };
  }

  const group: RawLeagueGroup = {
    state: row.state as LeagueState,
    season: row.season,
    clans: JSON.parse(row.clans),
    rounds: JSON.parse(row.rounds),
  };

  const tags = scheduledTags(group);
  const rows = tags.length
    ? await db().select().from(schema.leagueWars).where(inArray(schema.leagueWars.warTag, tags))
    : [];

  const wars: LeagueWarRecord[] = rows.map((w) => ({
    warTag: w.warTag,
    round: w.round,
    state: w.state as WarState,
    teamSize: w.teamSize,
    startTime: w.startTime?.toISOString() ?? null,
    endTime: w.endTime?.toISOString() ?? null,
    sides: JSON.parse(w.sides) as [LeagueSide, LeagueSide],
  }));

  return { status: 'ok', mock: false, fetchedAt: row.fetchedAt, league: analyseLeague(tag, group, wars) };
}
