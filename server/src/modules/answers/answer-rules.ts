import type { AnswerChange, AnswerSlot, WrittenAnswers } from '@exam-room/shared';
import type { AttemptRecord } from '../attempts/attempt-record.js';

export const ANSWER_CLOCK_TOLERANCE_MS = 2000;
export const LATE_ANSWER_WINDOW_MS = 10 * 60 * 1000;

const TYPED_WRITTEN_ANSWERS: ReadonlySet<WrittenAnswers> = new Set(['typed', 'typed_and_photos']);

export function isAnswerInTime(
  attempt: Pick<AttemptRecord, 'status' | 'finishedAt'>,
  answeredAt: number,
  receivedAt: number,
): boolean {
  const recordedAt = Math.min(answeredAt, receivedAt);
  if (attempt.status !== 'submitted' || attempt.finishedAt === null) return true;
  return (
    recordedAt <= attempt.finishedAt + ANSWER_CLOCK_TOLERANCE_MS &&
    receivedAt <= attempt.finishedAt + LATE_ANSWER_WINDOW_MS
  );
}

export function isAcceptingAnswers(
  attempt: Pick<AttemptRecord, 'status' | 'finishedAt'>,
  receivedAt: number,
): boolean {
  if (attempt.status !== 'submitted' || attempt.finishedAt === null) return true;
  return receivedAt <= attempt.finishedAt + LATE_ANSWER_WINDOW_MS;
}

export function answerProblem(
  slot: AnswerSlot | undefined,
  change: Pick<AnswerChange, 'choice' | 'text'>,
  writtenAnswers: WrittenAnswers,
): string | undefined {
  if (!slot) return 'This question is not on the paper.';
  const { unit } = slot;
  if (unit.kind === 'mcq') {
    if (change.text !== null) return `Question ${unit.label} takes a choice, not text.`;
    if (change.choice !== null && change.choice >= unit.options.length) {
      return `Question ${unit.label} has no such option.`;
    }
    return undefined;
  }
  if (change.choice !== null) return `Question ${unit.label} takes text, not a choice.`;
  if (
    unit.kind === 'written' &&
    change.text !== null &&
    !TYPED_WRITTEN_ANSWERS.has(writtenAnswers)
  ) {
    return 'This test takes written answers on paper.';
  }
  return undefined;
}
