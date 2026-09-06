/**
 * Deterministic mock data.
 *
 * Any tag produces a stable, plausible player or clan, so the whole UI is
 * exercisable with no API token. Swap in a real token and these are bypassed.
 * Everything here is clearly synthetic — no real player data is reproduced.
 */
import { TOWN_HALLS, MAX_TH } from '../../data/town-halls.js';
import { ALL_UNITS } from '../../data/army.js';

/** xmur3 + mulberry32: stable PRNG seeded from the tag string. */
function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const between = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

const FIRST = ['Storm', 'Iron', 'Night', 'Blaze', 'Frost', 'Shadow', 'Thunder', 'Crimson',
  'Silent', 'Rogue', 'Ember', 'Vortex', 'Titan', 'Onyx', 'Rapid', 'Wild'];
const SECOND = ['Raider', 'Wolf', 'King', 'Smasher', 'Hammer', 'Fang', 'Blade', 'Reaper',
  'Warden', 'Falcon', 'Bear', 'Viper', 'Knight', 'Sentinel', 'Drake', 'Bull'];
const CLAN_WORDS = ['Legion', 'Dynasty', 'Vanguard', 'Empire', 'Syndicate', 'Coalition',
  'Brotherhood', 'Ascendancy', 'Order', 'Collective'];
const ROLES = ['member', 'member', 'member', 'member', 'admin', 'admin', 'coLeader'];

const LEAGUES = [
  { id: 29000000, name: 'Unranked', min: 0 },
  { id: 29000006, name: 'Silver League II', min: 900 },
  { id: 29000009, name: 'Gold League III', min: 1200 },
  { id: 29000012, name: 'Crystal League III', min: 1800 },
  { id: 29000015, name: 'Master League III', min: 2600 },
  { id: 29000018, name: 'Champion League III', min: 3200 },
  { id: 29000021, name: 'Titan League III', min: 4100 },
  { id: 29000024, name: 'Legend League', min: 5000 },
];

const leagueFor = (trophies) => [...LEAGUES].reverse().find((l) => trophies >= l.min);

export function normalizeTag(tag) {
  const t = decodeURIComponent(String(tag)).toUpperCase().replace(/^#/, '').replace(/O/g, '0');
  return '#' + t.replace(/[^0289PYLQGRJCUV]/g, '');
}

function unitLevelsFor(rng, th, progress) {
  // `progress` 0..1 — how maxed this account is for its Town Hall.
  const roster = (kind) =>
    ALL_UNITS.filter((u) => u.kind === kind && u.max[th] > 0).map((u) => {
      const cap = u.max[th];
      const floor = u.max[Math.max(1, th - 1)] || 1;
      const lvl = Math.max(1, Math.min(cap, Math.round(floor + (cap - floor) * progress * (0.7 + rng() * 0.45))));
      return { name: u.name, level: lvl, maxLevel: u.maxLevel, village: 'home' };
    });

  return {
    troops: [...roster('troop'), ...roster('pet'), ...roster('siege')],
    spells: roster('spell'),
    heroes: ALL_UNITS.filter((u) => u.kind === 'hero' && u.max[th] > 0).map((u) => {
      const cap = u.max[th];
      const floor = u.max[Math.max(1, th - 1)] || 1;
      return {
        name: u.name,
        level: Math.max(1, Math.min(cap, Math.round(floor + (cap - floor) * progress * (0.6 + rng() * 0.5)))),
        maxLevel: u.maxLevel,
        village: 'home',
      };
    }),
  };
}

export function mockPlayer(tag, opts = {}) {
  const norm = normalizeTag(tag);
  const rng = seeded(norm);
  const th = opts.th ?? between(rng, 9, MAX_TH);
  const progress = 0.35 + rng() * 0.6;
  const trophies = between(rng, 1400 + th * 180, 1900 + th * 210);
  const name = opts.name ?? `${pick(rng, FIRST)}${pick(rng, SECOND)}`;
  const { troops, spells, heroes } = unitLevelsFor(rng, th, progress);

  return {
    tag: norm,
    name,
    townHallLevel: th,
    expLevel: between(rng, 60, 60 + th * 12),
    trophies,
    bestTrophies: trophies + between(rng, 0, 400),
    warStars: between(rng, 200, 200 + th * 190),
    attackWins: between(rng, 20, 900),
    defenseWins: between(rng, 5, 300),
    donations: between(rng, 200, 12000),
    donationsReceived: between(rng, 200, 12000),
    league: leagueFor(trophies),
    role: opts.role ?? pick(rng, ROLES),
    clan: opts.clan ?? null,
    troops, spells, heroes,
    _mock: true,
  };
}

export function mockClan(tag, opts = {}) {
  const norm = normalizeTag(tag);
  const rng = seeded(norm + 'clan');
  const size = opts.members ?? between(rng, 28, 50);
  const name = opts.name ?? `${pick(rng, FIRST)} ${pick(rng, CLAN_WORDS)}`;
  const level = between(rng, 6, 25);

  // Tags may only contain this alphabet — encoding the index in anything else
  // gets stripped by normalizeTag and every member collapses onto one seed.
  const ALPHABET = '0289PYLQGRJCUV';
  const suffix = (n) => (n < ALPHABET.length ? '' : suffix(Math.floor(n / ALPHABET.length))) + ALPHABET[n % ALPHABET.length];

  const memberList = Array.from({ length: size }, (_, i) => {
    const mTag = '#' + norm.slice(1) + 'V' + suffix(i);
    const p = mockPlayer(mTag);
    return {
      tag: p.tag,
      name: p.name,
      role: i === 0 ? 'leader' : i < 3 ? 'coLeader' : i < 8 ? 'admin' : 'member',
      townHallLevel: p.townHallLevel,
      expLevel: p.expLevel,
      league: p.league,
      trophies: p.trophies,
      donations: p.donations,
      donationsReceived: p.donationsReceived,
      clanRank: i + 1,
    };
  }).sort((a, b) => b.trophies - a.trophies).map((m, i) => ({ ...m, clanRank: i + 1 }));

  return {
    tag: norm,
    name,
    type: 'inviteOnly',
    description: 'Synthetic clan generated by ClashVerse for offline development.',
    clanLevel: level,
    clanPoints: memberList.reduce((s, m) => s + m.trophies, 0),
    warWins: between(rng, 40, 400),
    warLosses: between(rng, 20, 200),
    warTies: between(rng, 0, 12),
    warWinStreak: between(rng, 0, 14),
    warFrequency: 'always',
    isWarLogPublic: true,
    requiredTrophies: 1600 + between(rng, 0, 12) * 100,
    requiredTownhallLevel: between(rng, 9, 14),
    members: memberList.length,
    memberList,
    _mock: true,
  };
}

export function mockCurrentWar(tag) {
  const norm = normalizeTag(tag);
  const rng = seeded(norm + 'war');
  const teamSize = pick(rng, [15, 15, 20, 25, 30, 40, 50]);
  const clan = mockClan(norm);
  const opponent = mockClan('#' + norm.slice(1).split('').reverse().join(''));

  const roster = (src, oppSize, skill) =>
    src.memberList.slice(0, teamSize).map((m, i) => {
      const attacks = [];
      const used = rng() < skill ? 2 : rng() < 0.85 ? 1 : 0;
      for (let a = 0; a < used; a++) {
        const stars = rng() < skill ? 3 : rng() < 0.6 ? 2 : 1;
        attacks.push({
          attackerTag: m.tag,
          defenderTag: `#OPP${i}${a}`,
          stars,
          destructionPercentage: stars === 3 ? 100 : between(rng, 45, 99),
          order: i * 2 + a + 1,
        });
      }
      return {
        tag: m.tag, name: m.name, townhallLevel: m.townHallLevel, mapPosition: i + 1,
        attacks,
        opponentAttacks: between(rng, 0, 2),
        bestOpponentAttack: rng() < 0.7
          ? { stars: between(rng, 1, 3), destructionPercentage: between(rng, 50, 100) } : undefined,
      };
    });

  const skill = 0.55 + rng() * 0.25;
  const members = roster(clan, teamSize, skill);
  const oppMembers = roster(opponent, teamSize, skill - 0.1);
  const sum = (list) => list.reduce((s, m) => s + m.attacks.reduce((x, a) => x + a.stars, 0), 0);
  const pct = (list) =>
    list.reduce((s, m) => s + m.attacks.reduce((x, a) => x + a.destructionPercentage, 0), 0) /
    Math.max(1, teamSize * 2);

  const endTime = new Date(Date.now() + between(rng, 1, 20) * 3600_000);

  return {
    state: 'inWar',
    teamSize,
    attacksPerMember: 2,
    preparationStartTime: new Date(Date.now() - 36 * 3600_000).toISOString(),
    startTime: new Date(Date.now() - 12 * 3600_000).toISOString(),
    endTime: endTime.toISOString(),
    clan: {
      tag: clan.tag, name: clan.name, clanLevel: clan.clanLevel,
      attacks: members.reduce((s, m) => s + m.attacks.length, 0),
      stars: sum(members), destructionPercentage: pct(members), members,
    },
    opponent: {
      tag: opponent.tag, name: opponent.name, clanLevel: opponent.clanLevel,
      attacks: oppMembers.reduce((s, m) => s + m.attacks.length, 0),
      stars: sum(oppMembers), destructionPercentage: pct(oppMembers), members: oppMembers,
    },
    _mock: true,
  };
}

export function mockWarLog(tag, limit = 20) {
  const norm = normalizeTag(tag);
  const rng = seeded(norm + 'log');
  const items = Array.from({ length: limit }, (_, i) => {
    const teamSize = pick(rng, [15, 20, 25, 30, 40, 50]);
    const stars = between(rng, teamSize, teamSize * 3);
    const oppStars = between(rng, teamSize, teamSize * 3);
    return {
      result: stars > oppStars ? 'win' : stars < oppStars ? 'lose' : 'tie',
      endTime: new Date(Date.now() - (i + 1) * 2 * 86400_000).toISOString(),
      teamSize,
      clan: { tag: norm, name: mockClan(norm).name, stars, destructionPercentage: between(rng, 60, 100), expEarned: between(rng, 100, 400) },
      opponent: { tag: '#OPP' + i, name: `${pick(rng, FIRST)} ${pick(rng, CLAN_WORDS)}`, stars: oppStars, destructionPercentage: between(rng, 55, 100) },
    };
  });
  return { items, _mock: true };
}

export function mockClanSearch(name, limit = 10) {
  const rng = seeded('search:' + name);
  const items = Array.from({ length: limit }, (_, i) => {
    const c = mockClan('#SEARCH' + i + name.slice(0, 4).toUpperCase());
    return {
      tag: c.tag, name: `${name} ${pick(rng, CLAN_WORDS)}`, clanLevel: c.clanLevel,
      members: c.members, clanPoints: c.clanPoints, warWins: c.warWins,
      requiredTrophies: c.requiredTrophies, type: c.type,
    };
  });
  return { items, _mock: true };
}
