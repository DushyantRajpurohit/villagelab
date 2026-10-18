'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The masthead's section switch.
 *
 * A client component only because the current section has to be marked, and
 * the server cannot read the URL. It is three links and a string comparison, so
 * the cost of shipping it is a rounding error against knowing where you are.
 *
 * Matching is by prefix: `/player/2PP0JCVL9/builder` is still the Player
 * section, and the link stays marked while you move around inside it.
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
      /* The links scroll on a narrow screen; the fade at the right edge is
         what says so. It costs nothing on a wide screen, where the last link
         never reaches the edge to be faded. */
      className="flex min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none] [mask-image:linear-gradient(to_right,#000_88%,transparent)]"
    >
      {NAV.map((n) => {
        const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? 'page' : undefined}
            /* The current section is a solid kit-yellow block the full
               height of the masthead; the others invert on hover. */
            className={`display flex items-center px-2 text-[14px] whitespace-nowrap sm:px-3.5 sm:text-[15px] ${
              active ? 'bg-kit text-ink' : 'text-text hover:bg-chalk hover:text-ink'
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
