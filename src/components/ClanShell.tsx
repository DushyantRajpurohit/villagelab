import Link from 'next/link';
import type { ReactNode } from 'react';
import { TagSearch } from './TagSearch';

export type ClanTab = 'roster' | 'war' | 'log';

const TABS: Array<{ id: ClanTab; label: string; href: (t: string) => string }> = [
  { id: 'roster', label: 'Roster', href: (t) => `/clan/${t}` },
  { id: 'war', label: 'Current war', href: (t) => `/clan/${t}/war` },
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
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="display text-[22px]">Clan war room</h1>
          <p className="mt-1 max-w-[62ch] text-[13px] text-muted">
            Roster health, live war progress and war history.
          </p>
        </div>
        <div className="flex-1" />
        <TagSearch initial={tag} basePath="/clan" />
      </div>

      <nav aria-label="Clan views" className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.href(slug)}
            aria-current={t.id === active ? 'page' : undefined}
            className={
              t.id === active
                ? 'raised rounded-[10px] border border-gold-2 bg-gold px-3 py-1.5 text-[13px] font-bold text-ink'
                : 'rounded-md border border-line bg-panel-2 px-3 py-1.5 text-[13px] font-semibold text-text-2 transition hover:border-line hover:bg-panel-3'
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
