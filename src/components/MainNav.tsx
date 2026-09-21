'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The storefront's section switch.
 *
 * A client component only because the current section has to be marked, and
 * the server cannot read the URL. It is three links and a string comparison, so
 * the cost of shipping it is a rounding error against knowing where you are.
 *
 * Matching is by prefix: `/player/2PP0JCVL9/builder` is still the Player
 * section, and the pill stays lit while you move around inside it.
 */

const NAV = [
  { href: '/player', label: 'Player' },
  { href: '/planner', label: 'Planner' },
  { href: '/clan', label: 'War room' },
];

export function MainNav() {
  const pathname = usePathname() ?? '/';

  return (
    <nav
      aria-label="Sections"
      /* The pills scroll on a narrow screen; the fade at the right edge is
         what says so, since the scrollbar itself is hidden there. It costs
         nothing on a wide screen, where the last pill never reaches the
         edge to be faded. */
      className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [mask-image:linear-gradient(to_right,#000_88%,transparent)]"
    >
      {NAV.map((n) => {
        const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'rounded-full border border-gold/45 bg-gold/15 px-3.5 py-1.5 text-[13px] font-bold whitespace-nowrap text-gold'
                : 'rounded-full border border-transparent px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap text-text-2 transition hover:bg-panel-2 hover:text-text'
            }
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
