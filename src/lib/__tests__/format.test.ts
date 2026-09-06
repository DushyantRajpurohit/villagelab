import { describe, expect, it } from 'vitest';
import { fmtDuration, fmtInt, fmtRelative, fmtResource, parseCocDate } from '../format';

describe('fmtResource', () => {
  it.each([
    [0, '0'], [999, '999'], [1500, '1.5k'], [12_000, '12k'],
    [1_500_000, '1.5M'], [22_500_000, '22.5M'],
  ])('%i -> %s', (v, want) => expect(fmtResource(v)).toBe(want));

  it('renders an em dash rather than NaN for bad input', () => {
    expect(fmtResource(NaN)).toBe('—');
    expect(fmtResource(null)).toBe('—');
  });
});

describe('fmtDuration', () => {
  it.each([
    [0, 'instant'], [0.5, '30m'], [2, '2h'], [26, '1d 2h'], [336, '14d'],
  ])('%s hours -> %s', (v, want) => expect(fmtDuration(v)).toBe(want));

  it('never shows NaN', () => expect(fmtDuration(NaN)).toBe('—'));
});

describe('parseCocDate', () => {
  it('parses the compact ISO variant the API returns', () => {
    const d = parseCocDate('20240115T103000.000Z')!;
    expect(d.toISOString()).toBe('2024-01-15T10:30:00.000Z');
  });

  it('falls back to standard ISO', () => {
    expect(parseCocDate('2024-01-15T10:30:00Z')!.getUTCFullYear()).toBe(2024);
  });

  it('returns null for junk', () => expect(parseCocDate('not a date')).toBeNull());
});

describe('fmtRelative', () => {
  const now = Date.parse('2026-01-01T12:00:00Z');
  it('reads forwards and backwards', () => {
    expect(fmtRelative('2026-01-01T14:00:00Z', now)).toBe('in 2h');
    expect(fmtRelative('2025-12-31T12:00:00Z', now)).toBe('1d ago');
  });
});

describe('fmtInt', () => {
  it('groups thousands', () => expect(fmtInt(1234567)).toBe('1,234,567'));
});
