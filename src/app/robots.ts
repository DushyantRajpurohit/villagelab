import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://villagelab.is-a.dev';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Lookup forms produce no unique content and would waste crawl budget.
      disallow: ['/api/'],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
