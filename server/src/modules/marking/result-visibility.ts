import type { PaperQuestion } from '@exam-room/shared';
import type { AttemptRecord } from '../attempts/attempt-record.js';
import { applyTimeLimit } from '../attempts/attempt-rules.js';
import type { TestRecord } from '../tests/test-record.js';

export type ResultVisibility = 'final' | 'multiple_choice_only' | 'hidden';

export function resultVisibility(
  test: Pick<TestRecord, 'resultsReleasedAt' | 'instantMcqResult' | 'paperKind'>,
  attempt: AttemptRecord,
  currentTime: number,
): ResultVisibility {
  if (test.resultsReleasedAt !== null) return 'final';
  const isFinished = applyTimeLimit(attempt, currentTime).attempt.status === 'submitted';
  if (test.instantMcqResult && test.paperKind !== 'none' && isFinished) {
    return 'multiple_choice_only';
  }
  return 'hidden';
}

export function multipleChoiceMarksOf(questions: readonly PaperQuestion[]): number {
  return questions
    .filter((question) => question.kind === 'mcq')
    .reduce((total, question) => total + question.marks, 0);
}
