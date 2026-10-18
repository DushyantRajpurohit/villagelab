import Link from 'next/link';
import { MainNav } from './MainNav';
import { ThemeToggle } from './ThemeToggle';

/**
 * The masthead: the programme's name at the left, its sections beside it, the
 * one setting at the right.
 *
 * Solid pitch green on every page, so the site is recognisably one publication
 * whichever section is open. It sits on the pitch tokens, which is why the
 * links and the toggle inside it need no colours of their own.
 */
export function SiteHeader() {
  return (
    <header className="on-pitch sticky top-0 z-20 border-b-4 border-chalk">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-stretch gap-2 px-3 sm:gap-5 sm:px-5">
        <Link href="/" className="shelf-title flex shrink-0 items-center text-[21px] sm:text-[26px]">
          VillageLab
        </Link>
        <MainNav />
        <ThemeToggle />
      </div>
    </header>
  );
}
