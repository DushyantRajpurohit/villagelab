import type { MetadataRoute } from 'next';
import { desc } from 'drizzle-orm';
import { db, hasDatabase, schema } from '@/lib/db';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://villagelab.is-a.dev';

/** Regenerated daily; entity pages come from what we have actually ingested. */
export const revalidate = 86_400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/player`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE}/clan`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE}/planner`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/base`, changeFrequency: 'monthly', priority: 0.6 },
  ];

  if (!hasDatabase) return staticRoutes;

  // Cap the listing: sitemaps are limited to 50k URLs, and we would rather
  // point crawlers at the most active entities than at everything ever seen.
  const [players, clans] = await Promise.all([
    db().select({ tag: schema.players.tag, at: schema.players.fetchedAt })
      .from(schema.players).orderBy(desc(schema.players.trophies)).limit(20_000),
    // Each clan contributes two URLs below, so it gets a smaller share.
    db().select({ tag: schema.clans.tag, at: schema.clans.fetchedAt })
      .from(schema.clans).orderBy(desc(schema.clans.clanPoints)).limit(12_000),
  ]);

  return [
    ...staticRoutes,
    ...players.map((p) => ({
      url: `${SITE}/player/${p.tag.slice(1)}`,
      lastModified: p.at,
      changeFrequency: 'daily' as const,
      priority: 0.5,
    })),
    ...clans.flatMap((c) => [
      {
        url: `${SITE}/clan/${c.tag.slice(1)}`,
        lastModified: c.at,
        changeFrequency: 'daily' as const,
        priority: 0.5,
      },
      {
        // War history is stable, indexable content. The current-war page is
        // deliberately absent: it is empty most of the time and rewrites itself
        // hourly, which is exactly what a crawler should not be pointed at.
        url: `${SITE}/clan/${c.tag.slice(1)}/log`,
        lastModified: c.at,
        changeFrequency: 'daily' as const,
        priority: 0.4,
      },
    ]),
  ];
}
