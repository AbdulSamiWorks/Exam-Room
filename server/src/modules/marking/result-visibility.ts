import type { AttemptRecord } from '../attempts/attempt-record.js';
import { applyTimeLimit } from '../attempts/attempt-rules.js';
import type { TestRecord } from '../tests/test-record.js';

export type ResultVisibility = 'final' | 'automatic_only' | 'hidden';

export function resultVisibility(
  test: Pick<TestRecord, 'resultsReleasedAt' | 'instantResult' | 'paperKind'>,
  attempt: AttemptRecord,
  currentTime: number,
): ResultVisibility {
  if (test.resultsReleasedAt !== null) return 'final';
  const isFinished = applyTimeLimit(attempt, currentTime).attempt.status === 'submitted';
  if (test.instantResult && test.paperKind !== 'none' && isFinished) {
    return 'automatic_only';
  }
  return 'hidden';
}
