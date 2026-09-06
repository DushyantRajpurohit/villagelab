'use client';

import { useCallback, useLayoutEffect } from 'react';
import {
  applyTheme, readStoredTheme, THEME_ORDER, useThemeChoice, useThemeMounted,
  type Theme,
} from '@/lib/theme';

const LABEL: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' };

export function ThemeToggle() {
  const theme = useThemeChoice();
  const mounted = useThemeMounted();

  /**
   * React's Strict Mode remount in development resets <html> to only the
   * attributes it manages from JSX, wiping the one the inline head script set.
   * This puts it back. In production it is a no-op — the attribute is already
   * correct, and this runs before paint either way.
   */
  useLayoutEffect(() => {
    const stored = readStoredTheme();
    if (stored === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', stored);
  }, []);

  const cycle = useCallback(() => {
    applyTheme(THEME_ORDER[(THEME_ORDER.indexOf(readStoredTheme()) + 1) % THEME_ORDER.length]);
  }, []);

  const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[next]}.`}
      title={`Theme: ${LABEL[theme]} — click for ${LABEL[next]}`}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line bg-panel-2 px-2.5 text-[12px] font-bold text-text-2 transition hover:border-line-2 hover:text-text"
    >
      <Glyph theme={theme} />
      {/* Before hydration the stored choice is unknown, so a label would be a
          guess. The width is reserved either way to avoid a layout shift. */}
      <span className="hidden min-w-[3.2em] text-left sm:inline">{mounted ? LABEL[theme] : ''}</span>
    </button>
  );
}

function Glyph({ theme }: { theme: Theme }) {
  const common = { width: 14, height: 14, viewBox: '0 0 16 16', 'aria-hidden': true } as const;
  if (theme === 'light') {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="8" cy="8" r="3.1" />
        <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.1 3.1l1.1 1.1M11.8 11.8l1.1 1.1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1" />
      </svg>
    );
  }
  if (theme === 'dark') {
    return (
      <svg {...common} fill="currentColor">
        <path d="M13.4 9.9A5.8 5.8 0 0 1 6.1 2.6a5.9 5.9 0 1 0 7.3 7.3Z" />
      </svg>
    );
  }
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.6" y="2.8" width="12.8" height="8.6" rx="1.6" />
      <path d="M5.6 13.8h4.8" strokeLinecap="round" />
    </svg>
  );
}
