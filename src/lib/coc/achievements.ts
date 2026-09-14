/**
 * Lifetime records, read out of the player's achievements.
 *
 * The API publishes no balances beyond village loot: no Raid Medals, no League
 * Medals, no gems, no magic items, no helper levels. What it does publish is
 * the achievement list, and a handful of achievements count exactly the
 * activities those currencies are paid for — raid weekends, Clan War Leagues,
 * Clan Games. So the honest figure is the lifetime count of the activity, and
 * it is labelled as that, never as what the account holds now.
 *
 * A record the API did not send is `null`, not zero. Zero is a real answer —
 * an account that has never raided — and the two must not render alike.
 */

export interface RawAchievement {
  name: string;
  value: number;
  stars?: number;
  village?: string;
}

export type LifetimeId = 'capitalLooted' | 'capitalContributed' | 'leagueStars' | 'clanGames';

export interface LifetimeRecord {
  id: LifetimeId;
  label: string;
  /** What the count is of, in the words the game uses. */
  unit: string;
  value: number | null;
}

/** Achievement names exactly as the API spells them. */
const SOURCES: ReadonlyArray<Omit<LifetimeRecord, 'value'> & { achievement: string }> = [
  { id: 'capitalLooted', label: 'Raid weekends', unit: 'Capital Gold looted', achievement: 'Aggressive Capitalism' },
  { id: 'capitalContributed', label: 'Clan Capital', unit: 'Capital Gold contributed', achievement: 'Most Valuable Clanmate' },
  { id: 'leagueStars', label: 'Clan War Leagues', unit: 'league stars won', achievement: 'War League Legend' },
  { id: 'clanGames', label: 'Clan Games', unit: 'points earned', achievement: 'Games Champion' },
];

export const LIFETIME_ACHIEVEMENTS: readonly string[] = SOURCES.map((s) => s.achievement);

export function lifetimeRecords(achievements: readonly RawAchievement[] | undefined): LifetimeRecord[] {
  const byName = new Map((achievements ?? []).map((a) => [a.name, a]));
  return SOURCES.map(({ achievement, ...rest }) => {
    const v = byName.get(achievement)?.value;
    return { ...rest, value: typeof v === 'number' && Number.isFinite(v) ? v : null };
  });
}

/**
 * The slice of the achievement list worth storing. The full list is ninety-odd
 * entries on every player row, and the page reads four.
 */
export const keepLifetime = (achievements: readonly RawAchievement[] | undefined): RawAchievement[] =>
  (achievements ?? [])
    .filter((a) => LIFETIME_ACHIEVEMENTS.includes(a.name))
    .map(({ name, value, stars }) => ({ name, value, stars }));
