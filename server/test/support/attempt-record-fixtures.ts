import type { AttemptRecord, ExitEvent } from '../../src/modules/attempts/attempt-record.js';

export const STARTED_AT = 1_000_000;
export const DURATION_MS = 30 * 60 * 1000;
export const DEADLINE_AT = STARTED_AT + DURATION_MS;

export function attemptRecord(overrides: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    id: 1,
    testId: 1,
    studentId: 1,
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

export function exitEvent(leftAt = STARTED_AT + 60_000): ExitEvent {
  return {
    clientExitId: `exit-${leftAt}`,
    reason: 'hidden',
    leftAt,
    returnedAt: null,
    awayMs: null,
  };
}
