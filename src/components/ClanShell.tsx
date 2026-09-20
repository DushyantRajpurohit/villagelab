import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHead } from './primitives';
import { TagSearch } from './TagSearch';

export type ClanTab = 'roster' | 'war' | 'league' | 'log';

const TABS: Array<{ id: ClanTab; label: string; href: (t: string) => string }> = [
  { id: 'roster', label: 'Roster', href: (t) => `/clan/${t}` },
  { id: 'war', label: 'Current war', href: (t) => `/clan/${t}/war` },
  { id: 'league', label: 'War league', href: (t) => `/clan/${t}/league` },
  { id: 'log', label: 'War log', href: (t) => `/clan/${t}/log` },
];

/**
 * Shared chrome for every clan view.
 *
 * The tabs are real routes rather than client state: a war roster someone wants
 * to share is a link, and each view is server-rendered and cached on its own.
 */
export function ClanShell({ tag, active, children }: {
  tag: string; active: ClanTab; children: ReactNode;
}) {
  const slug = encodeURIComponent(tag.replace(/^#/, ''));

  return (
    <main className="mx-auto w-full max-w-[1400px] p-5">
      <PageHead
        title="Clan war room"
        sub="Roster health, live war progress, the war league and war history."
        action={<TagSearch initial={tag} basePath="/clan" />}
      />

      <nav aria-label="Clan views" className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.href(slug)}
            aria-current={t.id === active ? 'page' : undefined}
            className={
              t.id === active
                ? 'btn btn-gold raised rounded-full px-4 py-1.5 text-[13px]'
                : 'btn btn-ghost rounded-full px-4 py-1.5 text-[13px]'
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-4">{children}</div>
    </main>
  );
}
