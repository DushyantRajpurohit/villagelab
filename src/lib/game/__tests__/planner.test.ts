import { describe, expect, it } from 'vitest';
import { BUILDINGS_BY_ID } from '../buildings';
import { UNITS_BY_ID } from '../army';
import {
  bucketsFor, buildingRemaining, rebalance, schedule, sumBuckets, unitRemaining, weakest,
} from '../planner';
import type { QueueItem } from '../types';

const q = (over: Partial<QueueItem>): QueueItem => ({
  uid: Math.random().toString(36), kind: 'building', id: 'x', name: 'X',
  from: 1, to: 2, cost: 0, hours: 0, est: false, resource: 'gold', lane: 'builder',
  ...over,
});

describe('buckets', () => {
  const cannon = BUILDINGS_BY_ID.cannon;

  it('defaults every structure to the previous Town Hall ceiling', () => {
    const b = bucketsFor(undefined, cannon, 14);
    expect(sumBuckets(b)).toBe(cannon.count[14]);
    expect(Object.keys(b)).toEqual([String(cannon.max[13])]);
  });

  it('keeps saved state when it already totals the structure count', () => {
    const saved = { 15: 4, 16: 3 };
    const b = bucketsFor(saved, cannon, 14);
    expect(b).toEqual(saved);
  });

  it('tops up at the lowest level when the count grew with the Town Hall', () => {
    // cannon count rises from 7 (TH14) to 8 (TH15)
    const b = bucketsFor({ 20: 7 }, cannon, 15);
    expect(sumBuckets(b)).toBe(cannon.count[15]);
  });

  it('weakest() picks the lowest occupied level, ignoring empty buckets', () => {
    expect(weakest({ 12: 0, 14: 2, 16: 1 })).toBe(14);
    expect(weakest({})).toBeNull();
  });

  it('rebalance trims from the highest level when over count', () => {
    const r = rebalance({ 10: 3, 12: 5 }, 4);
    expect(sumBuckets(r)).toBe(4);
    expect(r[10]).toBe(3); // low levels survive; the top is trimmed
  });
});

describe('remaining cost', () => {
  it('counts every structure below the cap, not just one', () => {
    const cannon = BUILDINGS_BY_ID.cannon;
    const one = buildingRemaining(cannon, { 18: 1 }, 14);
    const three = buildingRemaining(cannon, { 18: 3 }, 14);
    expect(three.cost).toBe(one.cost * 3);
    expect(three.pending).toBe(3);
  });

  it('is zero once everything sits at the Town Hall cap', () => {
    const cannon = BUILDINGS_BY_ID.cannon;
    const r = buildingRemaining(cannon, { [cannon.max[14]]: cannon.count[14] }, 14);
    expect(r.cost).toBe(0);
    expect(r.pending).toBe(0);
  });

  it('sums a unit from its current level to the Town Hall cap', () => {
    const hog = UNITS_BY_ID.hog_rider;
    const cap = hog.max[14];
    const r = unitRemaining(hog, cap - 1, 14);
    expect(r.cost).toBe(hog.levels[cap]!.cost);
    expect(r.pending).toBe(1);
  });
});

describe('schedule', () => {
  it('spreads builder work across the pool and reports the true finish', () => {
    const s = schedule(
      [q({ hours: 10 }), q({ hours: 6 }), q({ hours: 4 })],
      2,
    );
    // lane0: 10, lane1: 6 then 4 -> both finish at 10
    expect(s.items[0].laneIndex).toBe(0);
    expect(s.items[1].laneIndex).toBe(1);
    expect(s.items[2].laneIndex).toBe(1);
    expect(s.items[2].start).toBe(6);
    expect(s.finishHours).toBe(10);
  });

  it('runs lab and hero work in parallel with builders, not against them', () => {
    const s = schedule(
      [q({ hours: 100 }), q({ lane: 'lab', hours: 20 }), q({ lane: 'hero', hours: 30 })],
      1,
    );
    expect(s.items[1].start).toBe(0);
    expect(s.items[2].start).toBe(0);
    expect(s.finishHours).toBe(100);
  });

  it('serialises the laboratory — only one research at a time', () => {
    const s = schedule(
      [q({ lane: 'lab', hours: 20 }), q({ lane: 'lab', hours: 30 })],
      4,
    );
    expect(s.items[1].start).toBe(20);
    expect(s.finishHours).toBe(50);
  });

  it('lets an instant upgrade free its builder immediately', () => {
    // walls cost gold but take no time; they must not consume a builder slot
    const s = schedule([q({ hours: 0 }), q({ hours: 12 })], 1);
    expect(s.items[1].start).toBe(0);
    expect(s.finishHours).toBe(12);
  });

  it('handles an empty queue without producing NaN', () => {
    const s = schedule([], 3);
    expect(s.finishHours).toBe(0);
    expect(s.items).toEqual([]);
  });
});
