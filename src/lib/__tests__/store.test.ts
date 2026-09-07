import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, exportState, parseImport } from '@/lib/store';

/**
 * The store went from one flat Home Village to a slice per village. Someone who
 * had recorded their village before that change must not lose it, so the lift
 * is covered here rather than trusted.
 */

const V1 = {
  th: 12,
  builders: 5,
  village: { cannon: { 11: 4, 12: 3 } },
  lab: { barbarian: 9 },
  queue: [{
    uid: 'x', kind: 'building', id: 'cannon', name: 'Cannon',
    from: 11, to: 12, cost: 100, hours: 2, est: false, resource: 'gold', lane: 'builder',
  }],
  layouts: [{ id: 'ly1', name: 'war base', th: 12, tiles: [], updated: '2026-01-01T00:00:00Z' }],
  resources: { gold: 500, elixir: 400, dark: 30 },
  playerTag: '#2PP',
  clanTag: '#ABC',
};

describe('the two villages have separate state', () => {
  it('gives each village its own hall, builders, queue, layouts and resources', () => {
    expect(DEFAULT_STATE.home.hall).not.toBe(DEFAULT_STATE.builder.hall);
    expect(DEFAULT_STATE.home.resources).toHaveProperty('dark');
    // There is no dark elixir in the Builder Base.
    expect(DEFAULT_STATE.builder.resources).not.toHaveProperty('dark');
    for (const v of [DEFAULT_STATE.home, DEFAULT_STATE.builder]) {
      expect(v.queue).toEqual([]);
      expect(v.layouts).toEqual([]);
      expect(v.village).toEqual({});
    }
  });

  it('does not share a mutable object between the two villages', () => {
    expect(DEFAULT_STATE.home).not.toBe(DEFAULT_STATE.builder);
    expect(DEFAULT_STATE.home.resources).not.toBe(DEFAULT_STATE.builder.resources);
  });
});

describe('parseImport', () => {
  it('lifts a pre-split save into the home village, losing nothing', () => {
    const s = parseImport(JSON.stringify(V1));
    expect(s.home.hall).toBe(12);
    expect(s.home.builders).toBe(5);
    expect(s.home.village).toEqual({ cannon: { 11: 4, 12: 3 } });
    expect(s.home.lab).toEqual({ barbarian: 9 });
    expect(s.home.queue).toHaveLength(1);
    expect(s.home.layouts).toHaveLength(1);
    expect(s.home.resources).toEqual({ gold: 500, elixir: 400, dark: 30 });
    expect(s.playerTag).toBe('#2PP');
    expect(s.clanTag).toBe('#ABC');
  });

  it('starts the second village empty rather than copying the first', () => {
    const s = parseImport(JSON.stringify(V1));
    expect(s.builder.village).toEqual({});
    expect(s.builder.queue).toEqual([]);
    expect(s.builder.layouts).toEqual([]);
    expect(s.builder.hall).toBe(DEFAULT_STATE.builder.hall);
  });

  it('round-trips a post-split export', () => {
    const before = parseImport(JSON.stringify(V1));
    const after = parseImport(exportState(before));
    expect(after).toEqual(before);
  });

  it('fills in a village the file does not mention', () => {
    const s = parseImport(JSON.stringify({ home: { hall: 9 } }));
    expect(s.home.hall).toBe(9);
    expect(s.home.queue).toEqual([]);
    expect(s.builder).toEqual(DEFAULT_STATE.builder);
  });

  it('keeps a resource the file omits rather than dropping it to undefined', () => {
    const s = parseImport(JSON.stringify({ home: { resources: { gold: 7 } } }));
    expect(s.home.resources).toEqual({ gold: 7, elixir: 0, dark: 0 });
  });

  it('rejects something that is not a VillageLab export', () => {
    expect(() => parseImport('null')).toThrow();
    expect(() => parseImport('"hello"')).toThrow();
  });
});
