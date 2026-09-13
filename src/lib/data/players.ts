import { and, eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db, hasDatabase, schema } from '../db';
import { mockPlayer } from '../coc/mock';
import { isValidTag, normalizeTag } from '../coc/tags';
import type { RawPlayer } from '../coc/client';

/**
 * Read path for player pages.
 *
 * Nothing here calls Supercell. A miss enqueues the tag for the ingestion
 * worker and returns `status: 'queued'`, so a public route can never be used to
 * amplify traffic against an upstream rate limit we do not control.
 */

export type PlayerResult =
  | { status: 'ok'; player: RawPlayer; fetchedAt: Date; mock: boolean }
  | { status: 'queued' }
  | { status: 'invalid' }
  | { status: 'not_found' };

export async function getPlayer(rawTag: string): Promise<PlayerResult> {
  const tag = normalizeTag(rawTag);
  if (!isValidTag(tag)) return { status: 'invalid' };

  if (!hasDatabase) {
    return { status: 'ok', player: mockPlayer(tag), fetchedAt: new Date(), mock: true };
  }

  const [row] = await db()
    .select()
    .from(schema.players)
    .where(eq(schema.players.tag, tag))
    .limit(1);

  if (row) {
    const units = JSON.parse(row.units) as Pick<RawPlayer, 'troops' | 'spells' | 'heroes'>;
    return {
      status: 'ok',
      mock: false,
      fetchedAt: row.fetchedAt,
      player: {
        tag: row.tag, name: row.name, townHallLevel: row.townHallLevel,
        expLevel: row.expLevel, trophies: row.trophies, bestTrophies: row.bestTrophies,
        warStars: row.warStars, attackWins: row.attackWins,
        builderHallLevel: row.builderHallLevel || undefined,
        builderBaseTrophies: row.builderBaseTrophies || undefined,
        donations: row.donations, donationsReceived: row.donationsReceived,
        league: row.leagueName ? { name: row.leagueName } : undefined,
        clan: row.clanTag ? { tag: row.clanTag, name: '' } : undefined,
        role: row.role ?? undefined,
        ...units,
      },
    };
  }

  const [queued] = await db()
    .select({ notFound: schema.fetchQueue.notFound })
    .from(schema.fetchQueue)
    .where(and(eq(schema.fetchQueue.tag, tag), eq(schema.fetchQueue.kind, 'player')))
    .limit(1);

  if (queued?.notFound) return { status: 'not_found' };

  await enqueue(tag, 'player');
  return { status: 'queued' };
}

/**
 * Add a tag to the ingestion queue, or bump its priority if already waiting.
 * Priority is what lets an actively-viewed tag jump ahead of a bulk backfill.
 */
export async function enqueue(rawTag: string, kind: 'player' | 'clan' | 'war' | 'league', bump = 1) {
  if (!hasDatabase) return;
  const tag = normalizeTag(rawTag);
  await db()
    .insert(schema.fetchQueue)
    .values({ tag, kind, priority: bump })
    .onConflictDoUpdate({
      target: [schema.fetchQueue.tag, schema.fetchQueue.kind],
      set: { priority: sql`${schema.fetchQueue.priority} + ${bump}` },
    });
}
