/**
 * Lives outside lib/theme.ts because that module is `'use client'`: a server
 * component importing a value from it gets a client reference, not the string,
 * and the inline script in app/layout.tsx would read `localStorage[undefined]`.
 */
export const THEME_KEY = 'villagelab.theme';
