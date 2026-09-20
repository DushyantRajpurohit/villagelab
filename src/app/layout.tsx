import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { SiteHeader } from '@/components/SiteHeader';
import { THEME_KEY } from '@/lib/theme';
import './globals.css';

/**
 * Display face only, self-hosted.
 *
 * Body copy stays on a system stack — it renders instantly and needs no
 * download. Headings and figures get a heavy rounded face, which is what
 * carries the game's visual character; it is an independently licensed font
 * (SIL OFL, see fonts/LICENSE.md), not Supercell's proprietary typeface.
 *
 * `next/font/local` reads the file from disk at build time, so unlike
 * `next/font/google` it adds no network dependency to the build.
 */
const baloo = localFont({
  src: './fonts/baloo2-latin.woff2',
  weight: '400 800',
  variable: '--font-baloo',
  display: 'swap',
  fallback: ['ui-rounded', 'Segoe UI', 'system-ui', 'sans-serif'],
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
    <html lang="en" className={`${baloo.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg font-sans text-text">
        <SiteHeader />
        {children}
        {/* The store's own footer is a dark plinth under the content, carrying
            the legal lines and nothing that competes with the shelves above.
            The Fan Content Policy notice is required on any public fan site. */}
        <footer className="mt-auto border-t border-line bg-panel/50">
          <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-7 text-xs text-faint">
            <span className="display text-[14px] text-text-2">
              Village<span className="text-gold">Lab</span>
            </span>
            <p className="max-w-[72ch]">
              This material is unofficial and is not endorsed by Supercell. For more information see{' '}
              <a
                className="text-text-2 underline hover:text-gold"
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
