import type { AllowedExits } from '@exam-room/shared';
import { describe, expect, it } from 'vitest';
import type { ExitEvent } from '../src/modules/attempts/attempt-record.js';
import {
  applyTimeLimit,
  endByTeacher,
  exitsUsed,
  finishByStudent,
  registerExit,
  resumeOnNewDevice,
  unlockByTeacher,
  type ExitRules,
} from '../src/modules/attempts/attempt-rules.js';
import {
  attemptRecord,
  DEADLINE_AT,
  exitEvent,
  STARTED_AT,
} from './support/attempt-record-fixtures.js';

function lockAfter(allowedExits: AllowedExits): ExitRules {
  return { allowedExits, leaveRule: 'lock' };
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
    const change = registerExit(attemptRecord(), lockAfter(1), exit);
    expect(change.attempt).toMatchObject({ status: 'in_progress', exitCount: 1 });
    expect(change.newExit).toBe(exit);
  });

  it('locks the attempt when the student leaves more often than allowed', () => {
    const exit = exitEvent();
    const change = registerExit(attemptRecord({ exitCount: 1 }), lockAfter(1), exit);
    expect(change.attempt).toMatchObject({
      status: 'locked',
      exitCount: 2,
      finishedAt: exit.leftAt,
    });
    expect(change.newExit).toBe(exit);
  });

  it('locks on the first exit when no exits are allowed', () => {
    expect(registerExit(attemptRecord(), lockAfter(0), exitEvent()).attempt.status).toBe('locked');
  });

  it('gives forgiven exits back', () => {
    const attempt = attemptRecord({ exitCount: 2, forgivenExits: 1 });
    expect(registerExit(attempt, lockAfter(2), exitEvent()).attempt.status).toBe('in_progress');
  });

  it('submits the attempt as left the test when the leave rule is finish', () => {
    const exit = exitEvent();
    const change = registerExit(
      attemptRecord({ exitCount: 1 }),
      { allowedExits: 1, leaveRule: 'finish' },
      exit,
    );
    expect(change.attempt).toMatchObject({
      status: 'submitted',
      finishReason: 'left_test',
      exitCount: 2,
      finishedAt: exit.leftAt,
    });
    expect(change.newExit).toBe(exit);
  });

  it.each(['submitted', 'locked'] as const)('ignores exits when the attempt is %s', (status) => {
    const attempt = attemptRecord({ status });
    const change = registerExit(attempt, lockAfter(2), exitEvent());
    expect(change.attempt).toBe(attempt);
    expect(change.newExit).toBeUndefined();
  });
});

describe('resumeOnNewDevice', () => {
  const deviceChange: ExitEvent = { ...exitEvent(), reason: 'device_change' };

  it('moves the attempt to the new token and counts the device change as an exit', () => {
    const change = resumeOnNewDevice(attemptRecord(), 'new-token-hash', lockAfter(1), deviceChange);
    expect(change.attempt).toMatchObject({
      tokenHash: 'new-token-hash',
      status: 'in_progress',
      exitCount: 1,
    });
    expect(change.newExit).toBe(deviceChange);
  });

  it('locks when the device change is one exit too many', () => {
    const change = resumeOnNewDevice(attemptRecord(), 'new-token-hash', lockAfter(0), deviceChange);
    expect(change.attempt).toMatchObject({ tokenHash: 'new-token-hash', status: 'locked' });
  });

  it('moves a finished attempt to the new token without counting an exit', () => {
    const attempt = attemptRecord({ status: 'submitted', finishReason: 'student' });
    const change = resumeOnNewDevice(attempt, 'new-token-hash', lockAfter(1), deviceChange);
    expect(change.attempt).toMatchObject({ tokenHash: 'new-token-hash', exitCount: 0 });
    expect(change.newExit).toBeUndefined();
  });
});

describe('unlockByTeacher', () => {
  const lockedAttempt = attemptRecord({
    status: 'locked',
    exitCount: 2,
    finishedAt: STARTED_AT + 60_000,
  });

  it('opens a locked attempt again and forgives one exit', () => {
    const change = unlockByTeacher(lockedAttempt, STARTED_AT + 120_000);
    expect(change.attempt).toMatchObject({
      status: 'in_progress',
      finishedAt: null,
      exitCount: 2,
      forgivenExits: 1,
    });
    expect(exitsUsed(change.attempt)).toBe(1);
  });

  it('locks again on the next exit', () => {
    const unlocked = unlockByTeacher(lockedAttempt, STARTED_AT + 120_000).attempt;
    expect(
      registerExit(unlocked, lockAfter(1), exitEvent(STARTED_AT + 180_000)).attempt.status,
    ).toBe('locked');
  });

  it('submits the attempt as time up when the deadline has already passed', () => {
    expect(unlockByTeacher(lockedAttempt, DEADLINE_AT + 1).attempt).toMatchObject({
      status: 'submitted',
      finishReason: 'time_up',
      finishedAt: DEADLINE_AT,
      forgivenExits: 1,
    });
  });

  it.each(['in_progress', 'submitted'] as const)('changes nothing when %s', (status) => {
    const attempt = attemptRecord({ status });
    expect(unlockByTeacher(attempt, STARTED_AT + 1).attempt).toBe(attempt);
  });
});

describe('endByTeacher', () => {
  it('submits a running attempt as ended by the teacher', () => {
    expect(endByTeacher(attemptRecord(), STARTED_AT + 60_000).attempt).toMatchObject({
      status: 'submitted',
      finishReason: 'teacher',
      finishedAt: STARTED_AT + 60_000,
    });
  });

  it('records time up instead when the deadline has already passed', () => {
    expect(endByTeacher(attemptRecord(), DEADLINE_AT + 1).attempt).toMatchObject({
      status: 'submitted',
      finishReason: 'time_up',
      finishedAt: DEADLINE_AT,
    });
  });

  it.each(['submitted', 'locked'] as const)('leaves an attempt that is %s unchanged', (status) => {
    const attempt = attemptRecord({ status });
    expect(endByTeacher(attempt, STARTED_AT + 60_000).attempt).toBe(attempt);
  });
});
