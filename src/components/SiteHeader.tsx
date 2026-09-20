import Link from 'next/link';
import { MainNav } from './MainNav';
import { ThemeToggle } from './ThemeToggle';

/**
 * The storefront's top bar: brand at the left, sections in the middle, the one
 * setting at the right.
 *
 * Translucent over a blur rather than solid, so the page's art scrolls
 * underneath it and the bar reads as glass laid on the room — the same trick
 * the game's own shop header uses to stay out of the way of the art.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-15 w-full max-w-[1400px] items-center gap-4 px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          {/* A shield, not a square: the badge is the one place the site gets
              to look like a game crest, and a rounded box would read as an
              app icon. */}
          <span className="relative grid h-9 w-9 place-items-center">
            <svg viewBox="0 0 36 40" aria-hidden className="absolute inset-0 h-full w-full">
              <path
                d="M18 1.5 34 6.5v14c0 8.6-6.3 14.6-16 18.1C8.3 35.1 2 29.1 2 20.5v-14Z"
                fill="url(#crest)"
                stroke="#c98200"
                strokeWidth="1.5"
              />
              <defs>
                <linearGradient id="crest" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#ffd75a" />
                  <stop offset="1" stopColor="#f5a300" />
                </linearGradient>
              </defs>
            </svg>
            <span
              className="relative text-[16px] leading-none font-extrabold text-ink"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              V
            </span>
          </span>
          <span className="display hidden text-[17px] leading-none sm:block">
            Village<span className="text-gold">Lab</span>
          </span>
        </Link>

        <MainNav />

        <ThemeToggle />
      </div>

      {/* The lit edge under the bar. A plain border is a line; this is the
          light the bar is standing in front of. */}
      <div
        aria-hidden
        className="h-px w-full bg-gradient-to-r from-transparent via-gold/35 to-transparent"
      />
    </header>
  );
}
