import type { AttemptResult } from '@exam-room/shared';
import type { AttemptRecord, ExitEvent } from './attempt-record.js';
import { applyTimeLimit } from './attempt-rules.js';

export function summarizeAttempt(
  storedAttempt: AttemptRecord,
  exits: readonly ExitEvent[],
  currentTime: number,
): AttemptResult {
  const attempt = applyTimeLimit(storedAttempt, currentTime).attempt;
  const openExit = exits.find((exit) => exit.returnedAt === null);
  const awayUntil = attempt.finishedAt ?? currentTime;
  const closedAwayMs = exits.reduce((total, exit) => total + (exit.awayMs ?? 0), 0);
  const openAwayMs = openExit ? Math.max(0, awayUntil - openExit.leftAt) : 0;

  return {
    id: attempt.id,
    studentName: attempt.studentName,
    rollNumber: attempt.rollNumber,
    status: attempt.status,
    finishReason: attempt.finishReason,
    startedAt: attempt.startedAt,
    finishedAt: attempt.finishedAt,
    exitCount: attempt.exitCount,
    forgivenExits: attempt.forgivenExits,
    awayMs: closedAwayMs + openAwayMs,
    isAwayNow: attempt.status === 'in_progress' && openExit !== undefined,
  };
}
