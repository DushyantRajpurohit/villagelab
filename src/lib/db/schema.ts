import {
  pgTable, text, integer, timestamp, real, boolean,
  primaryKey, index, serial,
} from 'drizzle-orm/pg-core';

/* ==========================================================================
   The Supercell API is snapshot-only — it has no history endpoint. Everything
   interesting this app does (trophy trends, donation health over time, member
   churn, war form) exists because we persist those snapshots ourselves.

   Two shapes of table:
     *_current   one row per entity, overwritten — what pages render
     *_snapshots append-only time series — what charts read
   ========================================================================== */

/** Latest known state of a player. Overwritten on every successful fetch. */
export const players = pgTable('players', {
  tag: text('tag').primaryKey(),
  name: text('name').notNull(),
  townHallLevel: integer('town_hall_level').notNull(),
  expLevel: integer('exp_level').notNull().default(0),
  trophies: integer('trophies').notNull().default(0),
  bestTrophies: integer('best_trophies').notNull().default(0),
  warStars: integer('war_stars').notNull().default(0),
  attackWins: integer('attack_wins').notNull().default(0),
  donations: integer('donations').notNull().default(0),
  donationsReceived: integer('donations_received').notNull().default(0),
  leagueName: text('league_name'),
  /** Second village. Zero means never unlocked, which is a real answer. */
  builderHallLevel: integer('builder_hall_level').notNull().default(0),
  builderBaseTrophies: integer('builder_base_trophies').notNull().default(0),
  clanTag: text('clan_tag'),
  role: text('role'),
  /** Full unit level map, kept as JSON — shape is stable but wide. */
  units: text('units').notNull().default('{}'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('players_clan_idx').on(t.clanTag),
  index('players_fetched_idx').on(t.fetchedAt),
]);

/** Append-only. One row per successful fetch that showed a change. */
export const playerSnapshots = pgTable('player_snapshots', {
  id: serial('id').primaryKey(),
  playerTag: text('player_tag').notNull(),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  townHallLevel: integer('town_hall_level').notNull(),
  trophies: integer('trophies').notNull(),
  warStars: integer('war_stars').notNull(),
  donations: integer('donations').notNull(),
  donationsReceived: integer('donations_received').notNull(),
}, (t) => [
  index('player_snap_tag_time_idx').on(t.playerTag, t.capturedAt),
]);

export const clans = pgTable('clans', {
  tag: text('tag').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  clanLevel: integer('clan_level').notNull().default(1),
  clanPoints: integer('clan_points').notNull().default(0),
  members: integer('members').notNull().default(0),
  warWins: integer('war_wins').notNull().default(0),
  warLosses: integer('war_losses').notNull().default(0),
  warTies: integer('war_ties').notNull().default(0),
  warWinStreak: integer('war_win_streak').notNull().default(0),
  isWarLogPublic: boolean('is_war_log_public').notNull().default(false),
  requiredTrophies: integer('required_trophies').notNull().default(0),
  requiredTownhallLevel: integer('required_townhall_level').notNull().default(1),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('clans_points_idx').on(t.clanPoints),
]);

export const clanSnapshots = pgTable('clan_snapshots', {
  id: serial('id').primaryKey(),
  clanTag: text('clan_tag').notNull(),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  clanPoints: integer('clan_points').notNull(),
  members: integer('members').notNull(),
  warWins: integer('war_wins').notNull(),
}, (t) => [
  index('clan_snap_tag_time_idx').on(t.clanTag, t.capturedAt),
]);

/**
 * Membership over time. `leftAt` stays null while the player is in the clan —
 * this is what makes churn detection possible, which the API cannot answer.
 */
export const clanMemberships = pgTable('clan_memberships', {
  id: serial('id').primaryKey(),
  clanTag: text('clan_tag').notNull(),
  playerTag: text('player_tag').notNull(),
  role: text('role').notNull().default('member'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp('left_at', { withTimezone: true }),
}, (t) => [
  index('membership_clan_idx').on(t.clanTag, t.leftAt),
  index('membership_player_idx').on(t.playerTag),
]);

/**
 * One row per war, current or finished.
 *
 * The id is stable for the whole life of a war, so the worker can keep
 * overwriting the same row as attacks land — `state` is what separates a war
 * still being fought from one in the history.
 */
export const wars = pgTable('wars', {
  id: text('id').primaryKey(), // clanTag:opponentTag:endTime
  clanTag: text('clan_tag').notNull(),
  opponentTag: text('opponent_tag'),
  opponentName: text('opponent_name'),
  teamSize: integer('team_size').notNull(),
  /** preparation | inWar | warEnded. A war log entry is always warEnded. */
  state: text('state').notNull().default('warEnded'),
  /** One in Clan War Leagues, two in a regular war. */
  attacksPerMember: integer('attacks_per_member').notNull().default(2),
  result: text('result'), // win | lose | tie
  stars: integer('stars').notNull().default(0),
  opponentStars: integer('opponent_stars').notNull().default(0),
  destruction: real('destruction').notNull().default(0),
  opponentDestruction: real('opponent_destruction').notNull().default(0),
  /**
   * Opponent roster as JSON: enough to draw the matchup, and no more. They are
   * not our members, so they get no player rows and no snapshot history.
   */
  opponentRoster: text('opponent_roster').notNull().default('[]'),
  startTime: timestamp('start_time', { withTimezone: true }),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('wars_clan_time_idx').on(t.clanTag, t.endTime),
]);

/** Per-member war performance — powers "who actually shows up". */
export const warAttacks = pgTable('war_attacks', {
  id: serial('id').primaryKey(),
  warId: text('war_id').notNull(),
  playerTag: text('player_tag').notNull(),
  /** Denormalised: a war roster can contain players we have never ingested. */
  name: text('name').notNull().default(''),
  townHallLevel: integer('town_hall_level').notNull().default(0),
  mapPosition: integer('map_position').notNull(),
  attacksUsed: integer('attacks_used').notNull().default(0),
  attacksAllowed: integer('attacks_allowed').notNull().default(2),
  stars: integer('stars').notNull().default(0),
  destruction: real('destruction').notNull().default(0),
  /** Null means nobody attacked this base — not the same as being held to zero. */
  defenseStars: integer('defense_stars'),
  defenseDestruction: real('defense_destruction'),
}, (t) => [
  index('war_attacks_war_idx').on(t.warId),
  index('war_attacks_player_idx').on(t.playerTag),
]);

/**
 * A clan's Clan War League group for one season.
 *
 * Keyed per clan rather than per group: the API only ever answers "the group
 * this clan is in", and nothing identifies a group on its own. Eight tracked
 * clans in one group are eight small rows, which is cheaper than inventing an
 * identity the game does not publish.
 */
export const leagueGroups = pgTable('league_groups', {
  id: text('id').primaryKey(), // clanTag:season
  clanTag: text('clan_tag').notNull(),
  season: text('season').notNull(),
  /** preparation | inWar | ended */
  state: text('state').notNull(),
  /** Every clan in the group with its roster, as JSON. */
  clans: text('clans').notNull().default('[]'),
  /** Seven rounds of war tags, `#0` where a war is not scheduled yet. */
  rounds: text('rounds').notNull().default('[]'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('league_groups_clan_season_idx').on(t.clanTag, t.season),
]);

/**
 * One league war, shared by every clan in the group that fights it.
 *
 * Stored whole-group rather than only for the clan that asked, because the
 * standings are a sum over all of them: a clan's rank depends on wars it was
 * not in. A finished war never changes, so it is fetched once and then left.
 */
export const leagueWars = pgTable('league_wars', {
  warTag: text('war_tag').primaryKey(),
  season: text('season').notNull(),
  round: integer('round').notNull(),
  /** preparation | inWar | warEnded */
  state: text('state').notNull(),
  teamSize: integer('team_size').notNull(),
  /** Both sides, each with its folded member rows, as JSON. */
  sides: text('sides').notNull(),
  startTime: timestamp('start_time', { withTimezone: true }),
  endTime: timestamp('end_time', { withTimezone: true }),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('league_wars_season_idx').on(t.season),
]);

/**
 * The ingestion queue.
 *
 * Nothing is fetched from Supercell on a user request. A page miss enqueues the
 * tag and renders whatever we have (or a "first look, check back shortly"
 * state); the worker drains this on a schedule. That is what keeps a public
 * route from being an amplification vector against our rate limit.
 */
export const fetchQueue = pgTable('fetch_queue', {
  tag: text('tag').notNull(),
  kind: text('kind').notNull(), // player | clan | war | league
  /** Higher runs first. Actively-viewed entities get bumped. */
  priority: integer('priority').notNull().default(0),
  nextFetchAt: timestamp('next_fetch_at', { withTimezone: true }).notNull().defaultNow(),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  /** Cache negative lookups so bogus tags aren't retried forever. */
  notFound: boolean('not_found').notNull().default(false),
}, (t) => [
  primaryKey({ columns: [t.tag, t.kind] }),
  index('queue_due_idx').on(t.nextFetchAt, t.priority),
]);
