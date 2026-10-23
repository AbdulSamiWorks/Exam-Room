import type { AttemptMarking } from '@exam-room/shared';

export function unmarkedStudentCount(attempts: readonly AttemptMarking[]): number {
  return attempts.filter((attempt) => attempt.score.markedWrittenCount < attempt.score.writtenCount)
    .length;
}

export function describeMarkingProgress(attempt: AttemptMarking): string {
  const { writtenCount, markedWrittenCount } = attempt.score;
  if (writtenCount === 0) return 'Marked automatically';
  if (markedWrittenCount === writtenCount) return 'Marked';
  return `${markedWrittenCount} of ${writtenCount} written answers marked`;
}
