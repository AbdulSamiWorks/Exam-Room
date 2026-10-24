import type { AttemptMarking } from '@exam-room/shared';
import { countOf } from '../../../lib/text';

export function unmarkedStudentCount(attempts: readonly AttemptMarking[]): number {
  return attempts.filter((attempt) => attempt.score.markedWrittenCount < attempt.score.writtenCount)
    .length;
}

export function describeMarkingProgress(attempt: AttemptMarking): string {
  const photos = attempt.photoCount > 0 ? ` · ${countOf(attempt.photoCount, 'photo')}` : '';
  return `${describeWrittenMarking(attempt)}${photos}`;
}

function describeWrittenMarking({ score }: AttemptMarking): string {
  if (score.writtenCount === 0) return 'Marked automatically';
  if (score.markedWrittenCount === score.writtenCount) return 'Marked';
  return `${score.markedWrittenCount} of ${score.writtenCount} written answers marked`;
}
