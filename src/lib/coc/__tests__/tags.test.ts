import { describe, expect, it } from 'vitest';
import { isValidTag, normalizeTag } from '../tags';
import { extractIp } from '../rotate';

describe('normalizeTag', () => {
  it('adds the hash and uppercases', () => {
    expect(normalizeTag('2pp0jcvl9')).toBe('#2PP0JCVL9');
  });

  it('treats O as the zero it almost always is', () => {
    expect(normalizeTag('#2ppOjcvl9')).toBe('#2PP0JCVL9');
  });

  it('strips characters outside the tag alphabet', () => {
    // B, D, I, etc. are not valid tag characters
    expect(normalizeTag('#2PP0-JCVL9!')).toBe('#2PP0JCVL9');
  });

  it('rejects tags that are too short to be real', () => {
    expect(isValidTag('#2PP')).toBe(false);
    expect(isValidTag('#2PP0JCVL9')).toBe(true);
  });
});

describe('extractIp', () => {
  it('pulls the egress IP out of Supercell 403 text', () => {
    expect(extractIp('Invalid authorization: API key does not allow access from IP 203.0.113.42'))
      .toBe('203.0.113.42');
  });

  it('returns null when there is no IP to find', () => {
    expect(extractIp('something else entirely')).toBeNull();
    expect(extractIp(undefined)).toBeNull();
  });
});
