import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { href: '/player', label: 'Player' },
  { href: '/planner', label: 'Planner' },
  { href: '/clan', label: 'War room' },
  { href: '/base', label: 'Base builder' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line-2 bg-panel/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-5 px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span
            className="grid h-8 w-8 place-items-center rounded-[10px] border border-gold-2 bg-gradient-to-b from-gold to-gold-2 text-[17px] leading-none font-extrabold text-ink shadow-[0_2px_0_var(--color-gold-2)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            V
          </span>
          <span className="display text-[17px] leading-none">
            Village<span className="text-gold">Lab</span>
          </span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-full px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap text-text-2 transition hover:bg-panel-3 hover:text-text"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <ThemeToggle />
      </div>
    </header>
  );
}
