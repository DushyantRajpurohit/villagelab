/**
 * Deterministic mock data.
 *
 * Any tag produces a stable, plausible player or clan, so the whole app is
 * usable with no credentials and no database — which is also what the test
 * suite and CI run against. Everything here is clearly synthetic; no real
 * player data is reproduced.
 */
import { ALL_UNITS } from '../game/army';
import { EQUIPMENT } from '../game/equipment';
import { BUILDER_TROOPS, BUILDER_HEROES, MAX_BH } from '../game/builder-base';
import { MAX_TH } from '../game/town-halls';
import { normalizeTag } from './tags';
import type { RawPlayer } from './client';
import type { RawWar, RawWarLogEntry, RawWarMember } from '../war/types';

/** xmur3 seed + mulberry32: stable PRNG derived from the tag string. */
function seeded(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
const between = (rng: () => number, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

const FIRST = ['Storm', 'Iron', 'Night', 'Blaze', 'Frost', 'Shadow', 'Thunder', 'Crimson',
  'Silent', 'Rogue', 'Ember', 'Vortex', 'Titan', 'Onyx', 'Rapid', 'Wild'] as const;
const SECOND = ['Raider', 'Wolf', 'King', 'Smasher', 'Hammer', 'Fang', 'Blade', 'Reaper',
  'Warden', 'Falcon', 'Bear', 'Viper', 'Knight', 'Sentinel', 'Drake', 'Bull'] as const;
const CLAN_WORDS = ['Legion', 'Dynasty', 'Vanguard', 'Empire', 'Syndicate', 'Coalition',
  'Brotherhood', 'Ascendancy', 'Order', 'Collective'] as const;

const LEAGUES = [
  { name: 'Unranked', min: 0 }, { name: 'Silver League II', min: 900 },
  { name: 'Gold League III', min: 1200 }, { name: 'Crystal League III', min: 1800 },
  { name: 'Master League III', min: 2600 }, { name: 'Champion League III', min: 3200 },
  { name: 'Titan League III', min: 4100 }, { name: 'Legend League', min: 5000 },
] as const;

const leagueFor = (t: number) => [...LEAGUES].reverse().find((l) => t >= l.min)!;

/**
 * Tags may only contain this alphabet. Encoding a member index in anything else
 * gets stripped by normalizeTag, and every member collapses onto one seed —
 * which is exactly the bug that produced identical clan rosters.
 */
const TAG_ALPHABET = '0289PYLQGRJCUV';
const tagSuffix = (n: number): string =>
  (n < TAG_ALPHABET.length ? '' : tagSuffix(Math.floor(n / TAG_ALPHABET.length))) +
  TAG_ALPHABET[n % TAG_ALPHABET.length];

export interface MockOptions {
  th?: number;
  name?: string;
  role?: string;
  clan?: { tag: string; name: string } | null;
}

export function mockPlayer(tag: string, opts: MockOptions = {}): RawPlayer & { _mock: true } {
  const norm = normalizeTag(tag);
  const rng = seeded(norm);
  const th = opts.th ?? between(rng, 9, MAX_TH);
  const progress = 0.35 + rng() * 0.6;
  const trophies = between(rng, 1400 + th * 180, 1900 + th * 210);

  const roster = (kind: string) =>
    ALL_UNITS.filter((u) => u.kind === kind && u.max[th] > 0).map((u) => {
      const cap = u.max[th];
      const floor = u.max[Math.max(1, th - 1)] || 1;
      const level = Math.max(1, Math.min(cap,
        Math.round(floor + (cap - floor) * progress * (0.65 + rng() * 0.5))));
      return { name: u.name, level, village: 'home' as const };
    });

  // Builder Hall roughly tracks Town Hall, and lags for most accounts.
  const bh = Math.max(1, Math.min(MAX_BH, Math.round(th * 0.62) + between(rng, -1, 1)));
  const builderRoster = (units: typeof BUILDER_TROOPS) =>
    units.filter((u) => u.max[bh] > 0).map((u) => {
      const cap = u.max[bh];
      const floor = u.max[Math.max(1, bh - 1)] || 1;
      const level = Math.max(1, Math.min(cap,
        Math.round(floor + (cap - floor) * progress * (0.6 + rng() * 0.55))));
      return { name: u.name, level, village: 'builderBase' as const };
    });

  const builderTrophies = between(rng, 500 + bh * 320, 900 + bh * 380);

  // Equipment ownership is not derivable — the API is the only source for which
  // epics an account bought — so the mock buys some and skips others. Commons
  // always arrive with their hero.
  const equipment = EQUIPMENT.filter((e) => e.max[th] > 0)
    .filter((e) => e.rarity === 'common' || rng() < 0.55)
    .map((e) => {
      const cap = e.max[th];
      const level = Math.max(1, Math.min(cap, Math.round(cap * progress * (0.6 + rng() * 0.55))));
      return { name: e.name, level, village: 'home' as const };
    });

  return {
    tag: norm,
    name: opts.name ?? `${pick(rng, FIRST)}${pick(rng, SECOND)}`,
    townHallLevel: th,
    builderHallLevel: bh,
    builderBaseTrophies: builderTrophies,
    bestBuilderBaseTrophies: builderTrophies + between(rng, 0, 300),
    expLevel: between(rng, 60, 60 + th * 12),
    trophies,
    bestTrophies: trophies + between(rng, 0, 400),
    warStars: between(rng, 200, 200 + th * 190),
    attackWins: between(rng, 20, 900),
    donations: between(rng, 200, 12000),
    donationsReceived: between(rng, 200, 12000),
    league: leagueFor(trophies),
    role: opts.role ?? pick(rng, ['member', 'member', 'member', 'admin', 'coLeader']),
    clan: opts.clan ?? undefined,
    troops: [...roster('troop'), ...roster('pet'), ...roster('siege'), ...builderRoster(BUILDER_TROOPS)],
    spells: roster('spell'),
    heroes: [...roster('hero'), ...builderRoster(BUILDER_HEROES)],
    heroEquipment: equipment,
    _mock: true,
  };
}

export interface MockClanMember {
  tag: string; name: string; role: string; townHallLevel: number; expLevel: number;
  league: { name: string }; trophies: number; donations: number;
  donationsReceived: number; clanRank: number;
}

export function mockClan(tag: string, opts: { name?: string; members?: number } = {}) {
  const norm = normalizeTag(tag);
  const rng = seeded(norm + 'clan');
  const size = opts.members ?? between(rng, 28, 50);

  const memberList: MockClanMember[] = Array.from({ length: size }, (_, i) => {
    const p = mockPlayer('#' + norm.slice(1) + 'V' + tagSuffix(i));
    return {
      tag: p.tag, name: p.name,
      role: i === 0 ? 'leader' : i < 3 ? 'coLeader' : i < 8 ? 'admin' : 'member',
      townHallLevel: p.townHallLevel, expLevel: p.expLevel,
      league: p.league ?? { name: 'Unranked' },
      trophies: p.trophies, donations: p.donations,
      donationsReceived: p.donationsReceived, clanRank: i + 1,
    };
  })
    .sort((a, b) => b.trophies - a.trophies)
    .map((m, i) => ({ ...m, clanRank: i + 1 }));

  return {
    tag: norm,
    name: opts.name ?? `${pick(rng, FIRST)} ${pick(rng, CLAN_WORDS)}`,
    type: 'inviteOnly',
    description: 'Synthetic clan generated by VillageLab for offline development.',
    clanLevel: between(rng, 6, 25),
    clanPoints: memberList.reduce((s, m) => s + m.trophies, 0),
    warWins: between(rng, 40, 400),
    warLosses: between(rng, 20, 200),
    warTies: between(rng, 0, 12),
    warWinStreak: between(rng, 0, 14),
    isWarLogPublic: true,
    requiredTrophies: 1600 + between(rng, 0, 12) * 100,
    requiredTownhallLevel: between(rng, 9, 14),
    members: memberList.length,
    memberList,
    _mock: true as const,
  };
}

/* ------------------------------------------------------------------- wars */

/** The API's compact ISO variant. Emitting it keeps parseCocDate exercised. */
const cocDate = (d: Date): string =>
  d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '.000Z');

const starRoll = (rng: () => number): number => {
  const r = rng();
  return r < 0.06 ? 0 : r < 0.18 ? 1 : r < 0.52 ? 2 : 3;
};

const destructionFor = (rng: () => number, stars: number): number =>
  stars === 3 ? 100
    : stars === 2 ? between(rng, 65, 99)
    : stars === 1 ? between(rng, 40, 64)
    : between(rng, 5, 39);

const WAR_SIZES = [15, 20, 25, 30, 40, 50] as const;

function warRoster(clanTag: string, size: number): RawWarMember[] {
  return mockClan(clanTag, { members: size }).memberList
    .slice(0, size)
    .sort((a, b) => b.townHallLevel - a.townHallLevel || b.trophies - a.trophies)
    .map((m, i) => ({
      tag: m.tag,
      name: m.name,
      townhallLevel: m.townHallLevel,
      mapPosition: i + 1,
      opponentAttacks: 0,
      attacks: [],
    }));
}

/**
 * Attacks are generated against a *specific* defender so the star arithmetic is
 * real: two hits on the same base only ever add up to that base's best result.
 * That is what makes the per-member credit in war/analyse.ts testable against
 * the clan total instead of being taken on faith.
 */
function playAttacks(
  rng: () => number,
  attackers: RawWarMember[],
  defenders: RawWarMember[],
  attacksPerMember: number,
  effort: number,
  orderFrom: number,
): { stars: number; destruction: number; nextOrder: number } {
  const best = new Map<string, { stars: number; destruction: number }>();
  let order = orderFrom;

  for (const a of attackers) {
    const hits = rng() < effort ? attacksPerMember : rng() < effort ? 1 : 0;
    for (let n = 0; n < hits; n++) {
      const spread = Math.max(0, Math.min(defenders.length - 1,
        a.mapPosition - 1 + between(rng, -2, 2)));
      const d = defenders[spread];
      const stars = starRoll(rng);
      const destruction = destructionFor(rng, stars);
      a.attacks!.push({
        attackerTag: a.tag, defenderTag: d.tag, stars, destructionPercentage: destruction,
        order: order++,
      });
      d.opponentAttacks = (d.opponentAttacks ?? 0) + 1;
      const prior = best.get(d.tag);
      if (!prior || stars > prior.stars || (stars === prior.stars && destruction > prior.destruction)) {
        best.set(d.tag, { stars, destruction });
      }
      const heldBest = d.bestOpponentAttack;
      if (!heldBest || stars > heldBest.stars) {
        d.bestOpponentAttack = { attackerTag: a.tag, defenderTag: d.tag, stars, destructionPercentage: destruction };
      }
    }
  }

  const totals = [...best.values()];
  return {
    stars: totals.reduce((s, b) => s + b.stars, 0),
    // Destruction is averaged over every base, not just the ones that were hit.
    destruction: Math.round(
      (totals.reduce((s, b) => s + b.destruction, 0) / Math.max(1, defenders.length)) * 100) / 100,
    nextOrder: order,
  };
}

export function mockWar(tag: string): RawWar & { _mock: true } {
  const norm = normalizeTag(tag);
  const rng = seeded(norm + 'war');
  const state = pick(rng, ['preparation', 'inWar', 'inWar', 'inWar', 'warEnded', 'warEnded'] as const);
  const teamSize = pick(rng, WAR_SIZES);
  const attacksPerMember = 2;
  const oppTag = normalizeTag('#' + norm.slice(1, 8) + 'C');

  const ours = warRoster(norm, teamSize);
  const theirs = warRoster(oppTag, teamSize);

  // Preparation day has no attacks at all; a finished war has nearly all of them.
  const effort = state === 'preparation' ? 0 : state === 'inWar' ? 0.55 : 0.92;
  let order = 1;
  const us = playAttacks(rng, ours, theirs, attacksPerMember, effort, order);
  order = us.nextOrder;
  const them = playAttacks(rng, theirs, ours, attacksPerMember, effort * 0.95, order);

  const now = Date.now();
  const endsIn = state === 'preparation' ? 30 : state === 'inWar' ? 9 : -4; // hours
  const clan = mockClan(norm);
  const opponent = mockClan(oppTag);

  return {
    state,
    teamSize,
    attacksPerMember,
    preparationStartTime: cocDate(new Date(now - 26 * 3600_000)),
    startTime: cocDate(new Date(now + (state === 'preparation' ? 6 : -15) * 3600_000)),
    endTime: cocDate(new Date(now + endsIn * 3600_000)),
    clan: {
      tag: norm, name: clan.name, clanLevel: clan.clanLevel,
      attacks: ours.reduce((a, m) => a + (m.attacks?.length ?? 0), 0),
      stars: us.stars, destructionPercentage: us.destruction, members: ours,
    },
    opponent: {
      tag: oppTag, name: opponent.name, clanLevel: opponent.clanLevel,
      attacks: theirs.reduce((a, m) => a + (m.attacks?.length ?? 0), 0),
      stars: them.stars, destructionPercentage: them.destruction, members: theirs,
    },
    _mock: true,
  };
}

/**
 * Destruction has to track stars, or the log reads as nonsense — a war won
 * 54–51 cannot show 60% against the opponent's 92%. Fitting through "everything
 * flattened" (3 stars, 100%) and "nothing touched" (0 stars, ~25%) keeps every
 * generated row internally plausible.
 */
const destructionForRatio = (rng: () => number, starRatio: number): number =>
  Math.round(Math.max(10, Math.min(100, 25 + 75 * starRatio + (rng() * 8 - 4))) * 10) / 10;

export function mockWarLog(tag: string, limit = 20): RawWarLogEntry[] {
  const norm = normalizeTag(tag);
  const rng = seeded(norm + 'warlog');
  const strength = 0.55 + rng() * 0.25; // how hard this clan hits, as a star ratio
  const now = Date.now();
  const name = mockClan(norm).name;

  return Array.from({ length: limit }, (_, i) => {
    const teamSize = pick(rng, WAR_SIZES);
    const maxStars = teamSize * 3;
    const oppTag = normalizeTag('#' + norm.slice(1, 7) + tagSuffix(i + 3));
    const opponent = mockClan(oppTag);

    const ourRatio = Math.max(0.25, Math.min(1, strength + (rng() * 0.3 - 0.15)));
    // Most wars are close; the margin is small far more often than it is large.
    const margin = (0.01 + rng() * rng() * 0.35) * (rng() < strength ? -1 : 1);
    const theirRatio = Math.max(0.15, Math.min(1, ourRatio + margin));

    const stars = Math.round(maxStars * ourRatio);
    const oppStars = Math.round(maxStars * theirRatio);
    const destruction = destructionForRatio(rng, ourRatio);
    const oppDestruction = destructionForRatio(rng, theirRatio);

    const result: 'win' | 'lose' | 'tie' =
      stars !== oppStars ? (stars > oppStars ? 'win' : 'lose')
        : destruction !== oppDestruction ? (destruction > oppDestruction ? 'win' : 'lose')
        : 'tie';

    return {
      result,
      endTime: cocDate(new Date(now - (i + 1) * 47 * 3600_000)),
      teamSize,
      attacksPerMember: 2,
      clan: { tag: norm, name, stars, destructionPercentage: destruction },
      opponent: {
        tag: oppTag, name: opponent.name, stars: oppStars,
        destructionPercentage: oppDestruction,
      },
    };
  });
}
