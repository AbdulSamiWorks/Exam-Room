import type { AllowedExits } from '@exam-room/shared';
import type { AttemptChange, AttemptRecord, ExitEvent } from './attempt-record.js';

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

export function registerExit(
  attempt: AttemptRecord,
  allowedExits: AllowedExits,
  exit: ExitEvent,
): AttemptChange {
  if (attempt.status !== 'in_progress') return { attempt };

  const attemptWithExit = { ...attempt, exitCount: attempt.exitCount + 1 };
  const hasLeftTooOften = exitsUsed(attemptWithExit) > allowedExits;

  return {
    attempt: hasLeftTooOften
      ? { ...attemptWithExit, status: 'locked', finishedAt: exit.leftAt }
      : attemptWithExit,
    newExit: exit,
  };
}

export function resumeOnNewDevice(
  attempt: AttemptRecord,
  newTokenHash: string,
  allowedExits: AllowedExits,
  deviceChange: ExitEvent,
): AttemptChange {
  const withNewToken = { ...attempt, tokenHash: newTokenHash };
  return registerExit(withNewToken, allowedExits, deviceChange);
}
