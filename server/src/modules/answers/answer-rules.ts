import type { AnswerChange, NumberedQuestion, WrittenAnswers } from '@exam-room/shared';
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
  question: NumberedQuestion | undefined,
  change: Pick<AnswerChange, 'choice' | 'text'>,
  writtenAnswers: WrittenAnswers,
): string | undefined {
  if (!question) return 'This question is not on the paper.';
  if (question.kind === 'mcq') {
    if (change.text !== null) return `Question ${question.number} takes a choice, not text.`;
    if (change.choice !== null && change.choice >= question.options.length) {
      return `Question ${question.number} has no such option.`;
    }
    return undefined;
  }
  if (change.choice !== null) return `Question ${question.number} takes text, not a choice.`;
  if (change.text !== null && !TYPED_WRITTEN_ANSWERS.has(writtenAnswers)) {
    return 'This test takes written answers on paper.';
  }
  return undefined;
}
