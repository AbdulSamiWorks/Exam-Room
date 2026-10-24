import { describe, expect, it } from 'vitest';
import type { ExitEvent } from '../src/modules/attempts/attempt-record.js';
import { summarizeAttempt } from '../src/modules/attempts/attempt-results.js';
import {
  attemptRecord,
  DEADLINE_AT,
  exitEvent,
  STARTED_AT,
} from './support/attempt-record-fixtures.js';

function closedExit(leftAt: number, awayMs: number): ExitEvent {
  return { ...exitEvent(leftAt), returnedAt: leftAt + awayMs, awayMs };
}

describe('summarizeAttempt', () => {
  it('describes a running attempt without exits', () => {
    expect(
      summarizeAttempt(attemptRecord(), [], STARTED_AT + 60_000, {
        answeredCount: 4,
        photoCount: 2,
      }),
    ).toEqual({
      id: 1,
      studentName: 'Ayesha Khan',
      rollNumber: '17',
      status: 'in_progress',
      finishReason: null,
      startedAt: STARTED_AT,
      finishedAt: null,
      exitCount: 0,
      forgivenExits: 0,
      awayMs: 0,
      isAwayNow: false,
      answeredCount: 4,
      photoCount: 2,
      totalMarks: null,
      exits: [],
    });
  });

  it('adds up the time away of closed exits', () => {
    const exits = [closedExit(STARTED_AT + 1_000, 4_000), closedExit(STARTED_AT + 9_000, 6_000)];
    const result = summarizeAttempt(attemptRecord({ exitCount: 2 }), exits, STARTED_AT + 60_000);
    expect(result).toMatchObject({ exitCount: 2, awayMs: 10_000, isAwayNow: false });
  });

  it('counts a still-open exit until now', () => {
    const exits = [closedExit(STARTED_AT + 1_000, 4_000), exitEvent(STARTED_AT + 50_000)];
    const result = summarizeAttempt(attemptRecord({ exitCount: 2 }), exits, STARTED_AT + 60_000);
    expect(result).toMatchObject({ awayMs: 14_000, isAwayNow: true });
  });

  it('stops counting an open exit when the attempt finished', () => {
    const attempt = attemptRecord({
      status: 'locked',
      exitCount: 1,
      finishedAt: STARTED_AT + 50_000,
    });
    const result = summarizeAttempt(attempt, [exitEvent(STARTED_AT + 50_000)], DEADLINE_AT);
    expect(result).toMatchObject({ status: 'locked', awayMs: 0, isAwayNow: false });
  });

  it('shows an attempt past its deadline as submitted by time up', () => {
    expect(summarizeAttempt(attemptRecord(), [], DEADLINE_AT + 1)).toMatchObject({
      status: 'submitted',
      finishReason: 'time_up',
      finishedAt: DEADLINE_AT,
    });
  });
});
