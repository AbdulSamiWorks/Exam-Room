import type { PublicTestDetails } from '@exam-room/shared';
import { describeChapterNames, describeTestKind } from '../../../lib/describe-test-kind';

export function describeTestHeading(test: PublicTestDetails): string {
  return [describeTestKind(test.kind), test.subjectName, describeChapterNames(test.chapterNames)]
    .filter(Boolean)
    .join(' · ');
}
