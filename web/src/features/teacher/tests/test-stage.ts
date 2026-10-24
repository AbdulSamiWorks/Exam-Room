import type { TestSummary } from '@exam-room/shared';
import { describeDateTime } from '../../../lib/describe-date-time';

export type TestStage = 'not_open' | 'scheduled' | 'running' | 'marking' | 'released' | 'closed';

export type TestStageStatus = {
  stage: TestStage;
  label: string;
};

type StageFacts = Pick<
  TestSummary,
  | 'availability'
  | 'opensAt'
  | 'resultsReleasedAt'
  | 'studentCount'
  | 'finishedCount'
  | 'classStudentCount'
  | 'averageMarks'
  | 'maxMarks'
>;

export function testStageOf(test: StageFacts): TestStage {
  if (test.resultsReleasedAt !== null) return 'released';
  if (test.availability === 'open') return 'running';
  if (test.availability === 'scheduled') return 'scheduled';
  if (test.studentCount > 0) return 'marking';
  return test.availability === 'closed' ? 'closed' : 'not_open';
}

export function describeTestStage(test: StageFacts): TestStageStatus {
  const stage = testStageOf(test);
  switch (stage) {
    case 'released':
      return { stage, label: 'Results out' };
    case 'running':
      return { stage, label: 'Running' };
    case 'scheduled':
      return { stage, label: `Opens ${describeDateTime(test.opensAt)}` };
    case 'marking':
      return { stage, label: 'Finished · to mark' };
    case 'closed':
      return { stage, label: 'Closed' };
    case 'not_open':
      return { stage, label: 'Not open' };
  }
}

export function describeTestProgress(test: StageFacts): string {
  if (test.studentCount === 0) {
    return test.classStudentCount === 0
      ? 'No students in this class yet'
      : `0 of ${test.classStudentCount} started`;
  }
  const stillWriting = test.studentCount - test.finishedCount;
  const finished = `${test.finishedCount} of ${Math.max(test.classStudentCount, test.studentCount)} finished`;
  return stillWriting > 0 ? `${finished} · ${stillWriting} still in the test` : finished;
}

export function averagePercentOf(test: StageFacts): number | null {
  if (test.resultsReleasedAt === null || test.averageMarks === null) return null;
  if (!test.maxMarks) return null;
  return Math.round((test.averageMarks / test.maxMarks) * 100);
}
