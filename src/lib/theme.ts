'use client';

import { useSyncExternalStore } from 'react';

/**
 * Theme store.
 *
 * Three states: an explicit `light`/`dark` choice, or `system` — the absence of
 * a choice, which is a real state rather than a default. Someone who never
 * touched this should keep following their OS when it flips at sunset; someone
 * who explicitly picked Light should stay light through the same event. A
 * two-state toggle collapses those and gets the second one wrong.
 *
 * The stored choice is applied before first paint by an inline script in the
 * document head (see app/layout.tsx). Everything here only mirrors and changes
 * it — with one exception noted in ThemeToggle for React's dev-mode remount.
 */

export const THEME_KEY = 'villagelab.theme';

export type Theme = 'system' | 'light' | 'dark';

export const THEME_ORDER: Theme[] = ['system', 'light', 'dark'];

function read(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

const listeners = new Set<() => void>();
let choice: Theme | null = null;

function getSnapshot(): Theme {
  choice ??= read();
  return choice;
}
const getServerSnapshot = (): Theme => 'system';

function emit() {
  for (const l of listeners) l();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);

  // Another tab changing the theme should be reflected here too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY) { choice = read(); emit(); }
  };
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  // No attribute means "follow the system", which the CSS media query handles.
  // Setting data-theme="system" would match no rule at all.
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);

  try {
    if (theme === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode — the choice just won't survive a reload */
  }
  choice = theme;
  emit();
}

/** Re-reads storage; used to recover from React's dev-mode attribute reset. */
export const readStoredTheme = read;

/** The user's choice, including `system`. */
export function useThemeChoice(): Theme {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** False during SSR and hydration, true once the real store is live. */
export function useThemeMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
