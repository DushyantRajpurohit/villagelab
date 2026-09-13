import { and, asc, desc, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import { db, hasDatabase, schema } from '../db';
import * as coc from '../coc/client';
import { CocApiError } from '../coc/client';
import { normalizeTag } from '../coc/tags';
import { parseCocDate } from '../format';
import { analyseWar, standingOf } from '../war/analyse';
import { recordLeagueWar, roundOfWar, scheduledTags } from '../war/league';
import type { RawLeagueGroup, RawWar, RawWarLogEntry } from '../war/types';
import type { OpponentSlot } from '../data/wars';

/**
 * Ingestion worker.
 *
 * This is the only code that talks to Supercell. It drains the fetch queue in
 * priority order, writes current state plus an append-only snapshot, and
 * reschedules each tag. User requests never reach this path — see
 * src/lib/data/players.ts.
 *
 * Runs are deliberately bounded (`limit`) so a single invocation stays well
 * inside both the upstream rate limit and a serverless execution budget.
 */

/** How long before we look at a tag again, by queue priority. */
function nextInterval(kind: string, priority: number): number {
  const base = kind === 'war' ? 30 : kind === 'league' ? 60 : kind === 'clan' ? 120 : 360; // minutes
  // Actively-viewed entities accumulate priority and refresh sooner.
  const factor = Math.max(0.25, 1 - Math.min(priority, 20) / 25);
  return Math.round(base * factor);
}

export interface RunResult {
  /** False when the worker could not run at all — a configuration fault. */
  ran: boolean;
  processed: number;
  ok: number;
  notFound: number;
  failed: number;
  rateLimited: boolean;
  errors: string[];
}

export async function runIngestion({ limit = 20 }: { limit?: number } = {}): Promise<RunResult> {
  const result: RunResult = { ran: true, processed: 0, ok: 0, notFound: 0, failed: 0, rateLimited: false, errors: [] };
  if (!hasDatabase) {
    result.ran = false;
    result.errors.push('DATABASE_URL is not set');
    return result;
  }

  const due = await db()
    .select()
    .from(schema.fetchQueue)
    .where(and(
      lte(schema.fetchQueue.nextFetchAt, new Date()),
      eq(schema.fetchQueue.notFound, false),
    ))
    .orderBy(desc(schema.fetchQueue.priority), asc(schema.fetchQueue.nextFetchAt))
    .limit(limit);

  for (const job of due) {
    result.processed++;
    try {
      // A job may name its own next interval when it knows better than the
      // queue does — a league that is not running need not be asked hourly.
      let minutes: number | undefined;
      if (job.kind === 'player') await ingestPlayer(job.tag);
      else if (job.kind === 'clan') await ingestClan(job.tag);
      else if (job.kind === 'war') await ingestWar(job.tag);
      else if (job.kind === 'league') minutes = await ingestLeague(job.tag);
      else continue;

      result.ok++;
      await reschedule(job.tag, job.kind, minutes ?? nextInterval(job.kind, job.priority));
    } catch (err) {
      if (err instanceof CocApiError && err.isNotFound) {
        result.notFound++;
        // Cache the negative so a bogus tag is not retried forever.
        await db().update(schema.fetchQueue)
          .set({ notFound: true, lastError: 'not found' })
          .where(and(eq(schema.fetchQueue.tag, job.tag), eq(schema.fetchQueue.kind, job.kind)));
        continue;
      }

      if (err instanceof CocApiError && err.isRateLimited) {
        // Stop the whole run — continuing would only deepen the throttle.
        result.rateLimited = true;
        result.errors.push('rate limited; stopping run early');
        break;
      }

      result.failed++;
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`${job.kind} ${job.tag}: ${message}`);
      await db().update(schema.fetchQueue)
        .set({
          attempts: sql`${schema.fetchQueue.attempts} + 1`,
          lastError: message.slice(0, 500),
          // Exponential backoff, capped, so a persistently broken tag goes quiet.
          nextFetchAt: new Date(Date.now() + Math.min(2 ** job.attempts, 60) * 60_000),
        })
        .where(and(eq(schema.fetchQueue.tag, job.tag), eq(schema.fetchQueue.kind, job.kind)));
    }
  }

  return result;
}

async function reschedule(tag: string, kind: string, minutes: number) {
  await db().update(schema.fetchQueue)
    .set({
      nextFetchAt: new Date(Date.now() + minutes * 60_000),
      priority: 0, // consumed; viewing it again will raise it back
      attempts: 0,
      lastError: null,
    })
    .where(and(eq(schema.fetchQueue.tag, tag), eq(schema.fetchQueue.kind, kind)));
}

async function ingestPlayer(rawTag: string) {
  const tag = normalizeTag(rawTag);
  const p = await coc.getPlayer(tag);

  const units = JSON.stringify({ troops: p.troops ?? [], spells: p.spells ?? [], heroes: p.heroes ?? [] });
  const row = {
    tag: p.tag, name: p.name, townHallLevel: p.townHallLevel, expLevel: p.expLevel,
    trophies: p.trophies, bestTrophies: p.bestTrophies, warStars: p.warStars,
    attackWins: p.attackWins, donations: p.donations, donationsReceived: p.donationsReceived,
    leagueName: p.league?.name ?? null, clanTag: p.clan?.tag ?? null, role: p.role ?? null,
    builderHallLevel: p.builderHallLevel ?? 0, builderBaseTrophies: p.builderBaseTrophies ?? 0,
    units, fetchedAt: new Date(),
  };

  await db().insert(schema.players).values(row)
    .onConflictDoUpdate({ target: schema.players.tag, set: row });

  await snapshotPlayerIfChanged(p);
}

/**
 * Only append a snapshot when something actually moved. Storing an identical
 * row every cycle would burn the free-tier storage quota for no signal.
 */
async function snapshotPlayerIfChanged(p: coc.RawPlayer) {
  const [last] = await db()
    .select()
    .from(schema.playerSnapshots)
    .where(eq(schema.playerSnapshots.playerTag, p.tag))
    .orderBy(desc(schema.playerSnapshots.capturedAt))
    .limit(1);

  const changed = !last
    || last.trophies !== p.trophies
    || last.warStars !== p.warStars
    || last.donations !== p.donations
    || last.townHallLevel !== p.townHallLevel;

  if (!changed) return;

  await db().insert(schema.playerSnapshots).values({
    playerTag: p.tag, townHallLevel: p.townHallLevel, trophies: p.trophies,
    warStars: p.warStars, donations: p.donations, donationsReceived: p.donationsReceived,
  });
}

interface RawClan {
  tag: string; name: string; description?: string; clanLevel: number; clanPoints: number;
  members: number; warWins: number; warLosses?: number; warTies?: number; warWinStreak?: number;
  isWarLogPublic?: boolean; requiredTrophies?: number; requiredTownhallLevel?: number;
  memberList?: Array<{ tag: string; name: string; role: string; townHallLevel: number; trophies: number }>;
}

async function ingestClan(rawTag: string) {
  const tag = normalizeTag(rawTag);
  const c = (await coc.getClan(tag)) as unknown as RawClan;

  const row = {
    tag: c.tag, name: c.name, description: c.description ?? null,
    clanLevel: c.clanLevel, clanPoints: c.clanPoints, members: c.members,
    warWins: c.warWins ?? 0, warLosses: c.warLosses ?? 0, warTies: c.warTies ?? 0,
    warWinStreak: c.warWinStreak ?? 0, isWarLogPublic: c.isWarLogPublic ?? false,
    requiredTrophies: c.requiredTrophies ?? 0, requiredTownhallLevel: c.requiredTownhallLevel ?? 1,
    fetchedAt: new Date(),
  };

  await db().insert(schema.clans).values(row)
    .onConflictDoUpdate({ target: schema.clans.tag, set: row });

  await syncMemberships(c);

  // Members are worth having as player rows too; queue them at low priority.
  for (const m of c.memberList ?? []) {
    await db().insert(schema.fetchQueue)
      .values({ tag: m.tag, kind: 'player', priority: 0 })
      .onConflictDoNothing();
  }

  // Wars are only readable when the clan publishes its log; queuing the rest
  // would just buy two guaranteed 403s per cycle.
  if (c.isWarLogPublic) {
    await db().insert(schema.fetchQueue)
      .values({ tag: c.tag, kind: 'war', priority: 0 })
      .onConflictDoNothing();
  }

  // The league is queued either way. Outside a league, or where the group
  // cannot be read, it costs one call on a long interval rather than a retry.
  await db().insert(schema.fetchQueue)
    .values({ tag: c.tag, kind: 'league', priority: 0 })
    .onConflictDoNothing();
}

/**
 * Reconcile the roster: close out memberships for players who left, open new
 * ones for players who joined. This is what makes churn answerable later —
 * the API only ever reports "who is in the clan right now".
 */
async function syncMemberships(c: RawClan) {
  const current = new Set((c.memberList ?? []).map((m) => normalizeTag(m.tag)));

  const open = await db()
    .select()
    .from(schema.clanMemberships)
    .where(and(eq(schema.clanMemberships.clanTag, c.tag), isNull(schema.clanMemberships.leftAt)));

  const openTags = new Set(open.map((m) => m.playerTag));

  for (const m of open) {
    if (!current.has(m.playerTag)) {
      await db().update(schema.clanMemberships)
        .set({ leftAt: new Date() })
        .where(eq(schema.clanMemberships.id, m.id));
    }
  }

  for (const m of c.memberList ?? []) {
    const tag = normalizeTag(m.tag);
    if (openTags.has(tag)) continue;
    await db().insert(schema.clanMemberships)
      .values({ clanTag: c.tag, playerTag: tag, role: m.role ?? 'member' });
  }
}

/* ------------------------------------------------------------------- wars */

/** How many war log entries to backfill on each pass. */
const WAR_LOG_LIMIT = 25;

/**
 * A clan with a private war log 403s on both war endpoints. That is a settled
 * fact about the clan, not a transient failure, so it must not feed the retry
 * backoff — we record nothing and come back on the normal schedule.
 */
const isPrivateLog = (err: unknown) =>
  err instanceof CocApiError && err.status === 403 && !err.isInvalidIp;

async function ingestWar(rawTag: string) {
  const tag = normalizeTag(rawTag);

  try {
    const current = (await coc.getCurrentWar(tag)) as unknown as RawWar;
    // `notInWar` is a valid answer, not an error — there is simply nothing to store.
    if (current?.state && current.state !== 'notInWar') await saveWar(tag, current);
  } catch (err) {
    if (!isPrivateLog(err)) throw err;
  }

  try {
    const log = (await coc.getWarLog(tag, WAR_LOG_LIMIT)) as unknown as { items?: RawWarLogEntry[] };
    await saveWarLog(tag, log.items ?? []);
  } catch (err) {
    if (!isPrivateLog(err)) throw err;
  }
}

/** Stable for the whole life of a war, so repeated fetches overwrite one row. */
const warId = (clanTag: string, opponentTag: string | undefined, endTime: Date) =>
  `${clanTag}:${opponentTag ?? '?'}:${endTime.getTime()}`;

function warEndTime(raw: string | undefined): Date | null {
  const d = parseCocDate(raw);
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

async function saveWar(clanTag: string, war: RawWar) {
  const end = warEndTime(war.endTime);
  if (!end) return; // no end time means no stable identity; nothing to key on

  const a = analyseWar(war);
  const id = warId(clanTag, war.opponent?.tag, end);
  const roster: OpponentSlot[] = (war.opponent?.members ?? []).map((m) => ({
    tag: m.tag, name: m.name, th: m.townhallLevel, pos: m.mapPosition,
  }));

  const row = {
    id, clanTag,
    opponentTag: war.opponent?.tag ?? null,
    opponentName: war.opponent?.name ?? null,
    teamSize: war.teamSize,
    state: war.state,
    attacksPerMember: a.attacksPerMember,
    // Only a finished war has a result; an in-progress scoreline is not one.
    result: war.state === 'warEnded' ? resultOf(war) : null,
    stars: a.us.stars,
    opponentStars: a.them.stars,
    destruction: a.us.destruction,
    opponentDestruction: a.them.destruction,
    opponentRoster: JSON.stringify(roster),
    startTime: warEndTime(war.startTime),
    endTime: end,
    fetchedAt: new Date(),
  };

  await db().insert(schema.wars).values(row)
    .onConflictDoUpdate({ target: schema.wars.id, set: row });

  // Members are rewritten wholesale: a war roster is small and fixed, and
  // diffing it would cost more than replacing it.
  await db().delete(schema.warAttacks).where(eq(schema.warAttacks.warId, id));
  if (a.rows.length) {
    await db().insert(schema.warAttacks).values(a.rows.map((r) => ({
      warId: id,
      playerTag: r.tag,
      name: r.name,
      townHallLevel: r.townHallLevel,
      mapPosition: r.mapPosition,
      attacksUsed: r.attacksUsed,
      attacksAllowed: r.attacksAllowed,
      stars: r.stars,
      destruction: r.bestDestruction,
      defenseStars: r.defenseStars,
      defenseDestruction: r.defenseDestruction,
    })));
  }
}

const resultOf = (war: RawWar): 'win' | 'lose' | 'tie' => {
  const s = standingOf(war.clan, war.opponent);
  return s === 'ahead' ? 'win' : s === 'behind' ? 'lose' : 'tie';
};

/**
 * War log entries land in the same table with `state: 'warEnded'`.
 *
 * They carry no roster, so they never overwrite a war we ingested live — the
 * conflict clause deliberately leaves `opponent_roster` and the attack rows
 * alone, keeping the richer record we already hold for our own wars.
 */
async function saveWarLog(clanTag: string, items: RawWarLogEntry[]) {
  for (const e of items) {
    const end = warEndTime(e.endTime);
    if (!end) continue;
    const id = warId(clanTag, e.opponent?.tag, end);
    const set = {
      clanTag,
      opponentTag: e.opponent?.tag ?? null,
      opponentName: e.opponent?.name ?? null,
      teamSize: e.teamSize,
      state: 'warEnded',
      attacksPerMember: e.attacksPerMember ?? 2,
      result: e.result ?? null,
      stars: e.clan?.stars ?? 0,
      opponentStars: e.opponent?.stars ?? 0,
      destruction: e.clan?.destructionPercentage ?? 0,
      opponentDestruction: e.opponent?.destructionPercentage ?? 0,
      endTime: end,
      fetchedAt: new Date(),
    };
    await db().insert(schema.wars).values({ id, ...set })
      .onConflictDoUpdate({ target: schema.wars.id, set });
  }
}

/* --------------------------------------------------------- war leagues */

/**
 * How long to leave a clan that is not in a league. The group endpoint 404s for
 * most of every month, and asking hourly would spend the budget on that.
 */
const LEAGUE_IDLE_MINUTES = 12 * 60;

const isNotFound = (err: unknown) => err instanceof CocApiError && err.isNotFound;

/**
 * The group, then every war it has drawn — all of them, not just this clan's,
 * because the standings are a sum over the whole group.
 *
 * A finished war never changes, so one already stored as ended is skipped. That
 * bounds the cost: the first pass of a season fetches what has been drawn so
 * far, and each later pass fetches only the round in preparation and the round
 * being fought.
 */
async function ingestLeague(rawTag: string): Promise<number | undefined> {
  const tag = normalizeTag(rawTag);

  let group: RawLeagueGroup;
  try {
    group = (await coc.getLeagueGroup(tag)) as unknown as RawLeagueGroup;
  } catch (err) {
    // A 404 here means "not in a league this season", not "no such clan".
    // Letting it reach the run loop would mark the tag not-found for good.
    if (isNotFound(err) || isPrivateLog(err)) return LEAGUE_IDLE_MINUTES;
    throw err;
  }
  if (!group?.season || group.state === 'notInWar') return LEAGUE_IDLE_MINUTES;

  const row = {
    id: `${tag}:${group.season}`,
    clanTag: tag,
    season: group.season,
    state: group.state,
    clans: JSON.stringify(group.clans ?? []),
    rounds: JSON.stringify(group.rounds ?? []),
    fetchedAt: new Date(),
  };
  await db().insert(schema.leagueGroups).values(row)
    .onConflictDoUpdate({ target: schema.leagueGroups.id, set: row });

  const tags = scheduledTags(group);
  if (tags.length) {
    const finished = new Set((await db()
      .select({ warTag: schema.leagueWars.warTag })
      .from(schema.leagueWars)
      .where(and(inArray(schema.leagueWars.warTag, tags), eq(schema.leagueWars.state, 'warEnded'))))
      .map((r) => r.warTag));

    for (const warTag of tags) {
      if (finished.has(warTag)) continue;
      let war: RawWar;
      try {
        war = (await coc.getLeagueWar(warTag)) as unknown as RawWar;
      } catch (err) {
        // One unreadable war must not cost the group; the next pass retries it.
        if (isNotFound(err)) continue;
        throw err;
      }
      if (!war?.state || war.state === 'notInWar') continue;

      const rec = recordLeagueWar(war, warTag, roundOfWar(group, warTag));
      const set = {
        season: group.season,
        round: rec.round,
        state: rec.state,
        teamSize: rec.teamSize,
        sides: JSON.stringify(rec.sides),
        startTime: warEndTime(war.startTime),
        endTime: warEndTime(war.endTime),
        fetchedAt: new Date(),
      };
      await db().insert(schema.leagueWars).values({ warTag, ...set })
        .onConflictDoUpdate({ target: schema.leagueWars.warTag, set });
    }
  }

  // A finished league will not change again; look for the next one slowly.
  return group.state === 'ended' ? LEAGUE_IDLE_MINUTES : undefined;
}
