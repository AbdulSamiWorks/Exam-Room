import type { AllowedExits, LeaveRule } from '@exam-room/shared';
import type { AttemptChange, AttemptRecord, ExitEvent } from './attempt-record.js';

export type ExitRules = {
  allowedExits: AllowedExits;
  leaveRule: LeaveRule;
};

export function exitsUsed(attempt: AttemptRecord): number {
  return attempt.exitCount - attempt.forgivenExits;
}

export function applyTimeLimit(attempt: AttemptRecord, currentTime: number): AttemptChange {
  if (attempt.status !== 'in_progress' || currentTime < attempt.deadlineAt) return { attempt };
  return {
    attempt: {
      ...attempt,
      status: 'submitted',
      finishReason: 'time_up',
      finishedAt: attempt.deadlineAt,
    },
  };
}

export function finishByStudent(attempt: AttemptRecord, currentTime: number): AttemptChange {
  if (attempt.status !== 'in_progress') return { attempt };
  return {
    attempt: {
      ...attempt,
      status: 'submitted',
      finishReason: 'student',
      finishedAt: currentTime,
    },
  };
}

export function endByTeacher(attempt: AttemptRecord, currentTime: number): AttemptChange {
  const timeLimitChange = applyTimeLimit(attempt, currentTime);
  if (timeLimitChange.attempt.status !== 'in_progress') return timeLimitChange;
  return {
    attempt: {
      ...attempt,
      status: 'submitted',
      finishReason: 'teacher',
      finishedAt: currentTime,
    },
  };
}

export function registerExit(
  attempt: AttemptRecord,
  exitRules: ExitRules,
  exit: ExitEvent,
): AttemptChange {
  if (attempt.status !== 'in_progress') return { attempt };

  const attemptWithExit = { ...attempt, exitCount: attempt.exitCount + 1 };
  const hasLeftTooOften = exitsUsed(attemptWithExit) > exitRules.allowedExits;

  return {
    attempt: hasLeftTooOften
      ? stopForLeaving(attemptWithExit, exitRules.leaveRule, exit.leftAt)
      : attemptWithExit,
    newExit: exit,
  };
}

function stopForLeaving(
  attempt: AttemptRecord,
  leaveRule: LeaveRule,
  leftAt: number,
): AttemptRecord {
  if (leaveRule === 'finish') {
    return { ...attempt, status: 'submitted', finishReason: 'left_test', finishedAt: leftAt };
  }
  return { ...attempt, status: 'locked', finishedAt: leftAt };
}

export function unlockByTeacher(attempt: AttemptRecord, currentTime: number): AttemptChange {
  if (attempt.status !== 'locked') return { attempt };
  const unlockedAttempt: AttemptRecord = {
    ...attempt,
    status: 'in_progress',
    finishedAt: null,
    forgivenExits: attempt.forgivenExits + 1,
  };
  return applyTimeLimit(unlockedAttempt, currentTime);
}

export function resumeOnNewDevice(
  attempt: AttemptRecord,
  newTokenHash: string,
  exitRules: ExitRules,
  deviceChange: ExitEvent,
): AttemptChange {
  const withNewToken = { ...attempt, tokenHash: newTokenHash };
  return registerExit(withNewToken, exitRules, deviceChange);
}

const MILLISECONDS_PER_MINUTE = 60_000;
export const LONGEST_ASSIGNMENT_MS = 30 * 24 * 60 * MILLISECONDS_PER_MINUTE;

export type DeadlineRules = {
  kind: 'test' | 'quiz' | 'assignment';
  durationMinutes: number;
  closesAt: number | null;
};

export function deadlineFor(test: DeadlineRules, startedAt: number): number {
  if (test.kind !== 'assignment') return startedAt + test.durationMinutes * MILLISECONDS_PER_MINUTE;
  return test.closesAt ?? startedAt + LONGEST_ASSIGNMENT_MS;
}

export function watchesExits(test: Pick<DeadlineRules, 'kind'>): boolean {
  return test.kind !== 'assignment';
}
