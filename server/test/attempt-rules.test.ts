import { describe, expect, it } from 'vitest';
import type { AttemptRecord, ExitEvent } from '../src/modules/attempts/attempt-record.js';
import {
  applyTimeLimit,
  exitsUsed,
  finishByStudent,
  registerExit,
  resumeOnNewDevice,
} from '../src/modules/attempts/attempt-rules.js';

const STARTED_AT = 1_000_000;
const DURATION_MS = 30 * 60 * 1000;
const DEADLINE_AT = STARTED_AT + DURATION_MS;

function attemptRecord(overrides: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    id: 1,
    testId: 1,
    studentName: 'Ayesha Khan',
    rollNumber: '17',
    tokenHash: 'original-token-hash',
    status: 'in_progress',
    finishReason: null,
    startedAt: STARTED_AT,
    deadlineAt: DEADLINE_AT,
    finishedAt: null,
    exitCount: 0,
    forgivenExits: 0,
    version: 0,
    ...overrides,
  };
}

function exitEvent(leftAt = STARTED_AT + 60_000): ExitEvent {
  return {
    clientExitId: `exit-${leftAt}`,
    reason: 'hidden',
    leftAt,
    returnedAt: null,
    awayMs: null,
  };
}

describe('exitsUsed', () => {
  it('does not count forgiven exits', () => {
    expect(exitsUsed(attemptRecord({ exitCount: 3, forgivenExits: 1 }))).toBe(2);
  });
});

describe('applyTimeLimit', () => {
  it('keeps the attempt running before the deadline', () => {
    const attempt = attemptRecord();
    expect(applyTimeLimit(attempt, DEADLINE_AT - 1)).toEqual({ attempt });
  });

  it('submits the attempt as time up at the deadline, finished at the deadline', () => {
    const change = applyTimeLimit(attemptRecord(), DEADLINE_AT + 5_000);
    expect(change.attempt).toMatchObject({
      status: 'submitted',
      finishReason: 'time_up',
      finishedAt: DEADLINE_AT,
    });
    expect(change.newExit).toBeUndefined();
  });

  it.each(['submitted', 'locked'] as const)('leaves a %s attempt alone', (status) => {
    const attempt = attemptRecord({ status, finishedAt: STARTED_AT + 10 });
    expect(applyTimeLimit(attempt, DEADLINE_AT + 1).attempt).toBe(attempt);
  });
});

describe('finishByStudent', () => {
  it('submits a running attempt at the current time', () => {
    const finishedAt = STARTED_AT + 120_000;
    expect(finishByStudent(attemptRecord(), finishedAt).attempt).toMatchObject({
      status: 'submitted',
      finishReason: 'student',
      finishedAt,
    });
  });

  it.each(['submitted', 'locked'] as const)('changes nothing when already %s', (status) => {
    const attempt = attemptRecord({ status });
    expect(finishByStudent(attempt, STARTED_AT + 1).attempt).toBe(attempt);
  });
});

describe('registerExit', () => {
  it('counts an exit and keeps the attempt running while within the allowed exits', () => {
    const exit = exitEvent();
    const change = registerExit(attemptRecord(), 1, exit);
    expect(change.attempt).toMatchObject({ status: 'in_progress', exitCount: 1 });
    expect(change.newExit).toBe(exit);
  });

  it('locks the attempt when the student leaves more often than allowed', () => {
    const exit = exitEvent();
    const change = registerExit(attemptRecord({ exitCount: 1 }), 1, exit);
    expect(change.attempt).toMatchObject({
      status: 'locked',
      exitCount: 2,
      finishedAt: exit.leftAt,
    });
    expect(change.newExit).toBe(exit);
  });

  it('locks on the first exit when no exits are allowed', () => {
    expect(registerExit(attemptRecord(), 0, exitEvent()).attempt.status).toBe('locked');
  });

  it('gives forgiven exits back', () => {
    const attempt = attemptRecord({ exitCount: 2, forgivenExits: 1 });
    expect(registerExit(attempt, 2, exitEvent()).attempt.status).toBe('in_progress');
  });

  it.each(['submitted', 'locked'] as const)('ignores exits when the attempt is %s', (status) => {
    const attempt = attemptRecord({ status });
    const change = registerExit(attempt, 2, exitEvent());
    expect(change.attempt).toBe(attempt);
    expect(change.newExit).toBeUndefined();
  });
});

describe('resumeOnNewDevice', () => {
  const deviceChange: ExitEvent = { ...exitEvent(), reason: 'device_change' };

  it('moves the attempt to the new token and counts the device change as an exit', () => {
    const change = resumeOnNewDevice(attemptRecord(), 'new-token-hash', 1, deviceChange);
    expect(change.attempt).toMatchObject({
      tokenHash: 'new-token-hash',
      status: 'in_progress',
      exitCount: 1,
    });
    expect(change.newExit).toBe(deviceChange);
  });

  it('locks when the device change is one exit too many', () => {
    const change = resumeOnNewDevice(attemptRecord(), 'new-token-hash', 0, deviceChange);
    expect(change.attempt).toMatchObject({ tokenHash: 'new-token-hash', status: 'locked' });
  });

  it('moves a finished attempt to the new token without counting an exit', () => {
    const attempt = attemptRecord({ status: 'submitted', finishReason: 'student' });
    const change = resumeOnNewDevice(attempt, 'new-token-hash', 1, deviceChange);
    expect(change.attempt).toMatchObject({ tokenHash: 'new-token-hash', exitCount: 0 });
    expect(change.newExit).toBeUndefined();
  });
});
