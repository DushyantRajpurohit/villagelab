import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { SiteHeader } from '@/components/SiteHeader';
import { THEME_KEY } from '@/lib/theme';
import './globals.css';

/**
 * One face, self-hosted, for everything.
 *
 * Archivo is a variable font with a width axis, so the same file sets the
 * condensed heavy headlines, the body text and the slightly narrowed table
 * figures. It is independently licensed (SIL OFL, see fonts/LICENSE.md), not
 * Supercell's proprietary typeface.
 *
 * `next/font/local` reads the file from disk at build time, so unlike
 * `next/font/google` it adds no network dependency to the build. The
 * `font-stretch` declaration is what tells the browser the width axis is there.
 */
const archivo = localFont({
  src: './fonts/archivo-latin-variable.woff2',
  weight: '100 900',
  variable: '--font-archivo',
  display: 'swap',
  declarations: [{ prop: 'font-stretch', value: '62% 125%' }],
  fallback: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://villagelab.is-a.dev';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'VillageLab — Clash of Clans progress, planning and war analytics',
    template: '%s · VillageLab',
  },
  description:
    'Track army progress against Town Hall maximums, plan upgrades across builders and lab, and watch clan war form over time.',
  openGraph: { type: 'website', siteName: 'VillageLab', url: SITE },
  robots: { index: true, follow: true },
};

/**
 * Applies a stored theme choice while the browser is still parsing, so the page
 * never paints in the wrong palette. Absence of the attribute means "follow the
 * system", which the CSS media query handles — so nothing is set unless the
 * visitor actually chose.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg font-sans text-text">
        <SiteHeader />
        {children}
        {/* The back page: an ink band carrying the colophon. The Fan Content
            Policy notice is required on any public fan site. The band is ink in
            both themes; a page ending in a white slab under the night fixture
            reads as a missing style. */}
        <footer className="mt-auto bg-ink text-chalk">
          <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-baseline gap-x-8 gap-y-3 px-5 py-7 text-[13px]">
            <span className="shelf-title text-[22px]">VillageLab</span>
            <p className="max-w-[72ch]">
              This material is unofficial and is not endorsed by Supercell. For more information see{' '}
              <a
                className="underline hover:bg-kit hover:text-ink"
                href="https://supercell.com/en/fan-content-policy/"
                rel="noopener noreferrer"
                target="_blank"
              >
                Supercell&rsquo;s Fan Content Policy
              </a>
              .
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
