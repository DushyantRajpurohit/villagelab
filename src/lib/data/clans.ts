import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, hasDatabase, schema } from '../db';
import { mockClan } from '../coc/mock';
import { isValidTag, normalizeTag } from '../coc/tags';
import { enqueue } from './players';

/** Read path for clan pages. Same contract as players: never fetch upstream here. */

export interface ClanMember {
  tag: string; name: string; role: string; townHallLevel: number;
  trophies: number; donations: number; donationsReceived: number; clanRank: number;
}

export interface ClanView {
  tag: string; name: string; description: string | null;
  clanLevel: number; clanPoints: number; members: number;
  warWins: number; warLosses: number; warTies: number; warWinStreak: number;
  requiredTrophies: number; requiredTownhallLevel: number;
  memberList: ClanMember[];
}

export type ClanResult =
  | { status: 'ok'; clan: ClanView; mock: boolean }
  | { status: 'queued' }
  | { status: 'invalid' }
  | { status: 'not_found' };

export async function getClan(rawTag: string): Promise<ClanResult> {
  const tag = normalizeTag(rawTag);
  if (!isValidTag(tag)) return { status: 'invalid' };

  if (!hasDatabase) {
    const c = mockClan(tag);
    return {
      status: 'ok',
      mock: true,
      clan: {
        tag: c.tag, name: c.name, description: c.description,
        clanLevel: c.clanLevel, clanPoints: c.clanPoints, members: c.members,
        warWins: c.warWins, warLosses: c.warLosses, warTies: c.warTies,
        warWinStreak: c.warWinStreak,
        requiredTrophies: c.requiredTrophies, requiredTownhallLevel: c.requiredTownhallLevel,
        memberList: c.memberList,
      },
    };
  }

  const [row] = await db().select().from(schema.clans).where(eq(schema.clans.tag, tag)).limit(1);
  if (!row) {
    await enqueue(tag, 'clan');
    return { status: 'queued' };
  }

  // Current membership joined to the latest player snapshot we hold.
  const members = await db()
    .select({
      tag: schema.players.tag,
      name: schema.players.name,
      role: schema.clanMemberships.role,
      townHallLevel: schema.players.townHallLevel,
      trophies: schema.players.trophies,
      donations: schema.players.donations,
      donationsReceived: schema.players.donationsReceived,
    })
    .from(schema.clanMemberships)
    .innerJoin(schema.players, eq(schema.players.tag, schema.clanMemberships.playerTag))
    .where(and(
      eq(schema.clanMemberships.clanTag, tag),
      // `= NULL` never matches in SQL — a still-current membership needs IS NULL
      isNull(schema.clanMemberships.leftAt),
    ))
    .orderBy(desc(schema.players.trophies));

  return {
    status: 'ok',
    mock: false,
    clan: {
      tag: row.tag, name: row.name, description: row.description,
      clanLevel: row.clanLevel, clanPoints: row.clanPoints, members: row.members,
      warWins: row.warWins, warLosses: row.warLosses, warTies: row.warTies,
      warWinStreak: row.warWinStreak,
      requiredTrophies: row.requiredTrophies, requiredTownhallLevel: row.requiredTownhallLevel,
      memberList: members.map((m, i) => ({ ...m, clanRank: i + 1 })),
    },
  };
}

/** Donation ratio, the roster-health number leaders actually care about. */
export const donationRatio = (m: ClanMember): number =>
  m.donationsReceived ? m.donations / m.donationsReceived : m.donations ? Infinity : 0;
