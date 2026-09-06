/** Player and clan tags use a restricted alphabet; O is a common typo for 0. */
const TAG_ALPHABET = '0289PYLQGRJCUV';

export function normalizeTag(tag: string): string {
  const t = String(tag).toUpperCase().replace(/^#/, '').replace(/O/g, '0');
  return '#' + [...t].filter((c) => TAG_ALPHABET.includes(c)).join('');
}

export const isValidTag = (tag: string): boolean =>
  /^#[0289PYLQGRJCUV]{5,12}$/.test(normalizeTag(tag));

export const encodeTag = (tag: string): string => encodeURIComponent(normalizeTag(tag));
