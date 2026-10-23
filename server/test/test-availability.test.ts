import { describe, expect, it } from 'vitest';
import {
  availabilityAt,
  closeNow,
  NOT_OPEN_SCHEDULE,
  openNow,
} from '../src/modules/tests/test-availability.js';

const NOW = 1_000_000;
const MINUTE_MS = 60_000;

describe('availabilityAt', () => {
  it('is not open while no opening time is set', () => {
    expect(availabilityAt(NOT_OPEN_SCHEDULE, NOW)).toBe('not_open');
  });

  it('is scheduled before the opening time and open from it', () => {
    const schedule = { opensAt: NOW, closesAt: null };
    expect(availabilityAt(schedule, NOW - 1)).toBe('scheduled');
    expect(availabilityAt(schedule, NOW)).toBe('open');
    expect(availabilityAt(schedule, NOW + 10 * MINUTE_MS)).toBe('open');
  });

  it('is closed from the closing time', () => {
    const schedule = { opensAt: NOW, closesAt: NOW + MINUTE_MS };
    expect(availabilityAt(schedule, NOW + MINUTE_MS - 1)).toBe('open');
    expect(availabilityAt(schedule, NOW + MINUTE_MS)).toBe('closed');
  });
});

describe('openNow', () => {
  it('opens a test that is not open yet', () => {
    expect(openNow(NOT_OPEN_SCHEDULE, NOW)).toEqual({ opensAt: NOW, closesAt: null });
  });

  it('keeps a closing time that is still ahead', () => {
    const scheduled = { opensAt: NOW + MINUTE_MS, closesAt: NOW + 2 * MINUTE_MS };
    expect(openNow(scheduled, NOW)).toEqual({ opensAt: NOW, closesAt: NOW + 2 * MINUTE_MS });
  });

  it('reopens a closed test without a closing time', () => {
    const closed = { opensAt: NOW - 2 * MINUTE_MS, closesAt: NOW - MINUTE_MS };
    expect(openNow(closed, NOW)).toEqual({ opensAt: NOW, closesAt: null });
  });

  it('leaves an open test unchanged', () => {
    const open = { opensAt: NOW - MINUTE_MS, closesAt: NOW + MINUTE_MS };
    expect(openNow(open, NOW)).toBe(open);
  });
});

describe('closeNow', () => {
  it('closes an open test at the current time', () => {
    const open = { opensAt: NOW - MINUTE_MS, closesAt: null };
    expect(closeNow(open, NOW)).toEqual({ opensAt: NOW - MINUTE_MS, closesAt: NOW });
  });

  it('cancels a scheduled opening', () => {
    const scheduled = { opensAt: NOW + MINUTE_MS, closesAt: null };
    expect(closeNow(scheduled, NOW)).toEqual(NOT_OPEN_SCHEDULE);
  });

  it('leaves a closed or not open test unchanged', () => {
    const closed = { opensAt: NOW - 2 * MINUTE_MS, closesAt: NOW - MINUTE_MS };
    expect(closeNow(closed, NOW)).toBe(closed);
    expect(closeNow(NOT_OPEN_SCHEDULE, NOW)).toBe(NOT_OPEN_SCHEDULE);
  });
});
