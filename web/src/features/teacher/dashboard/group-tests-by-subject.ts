import type { Subject, TestSummary } from '@exam-room/shared';

export type SubjectTestGroup = {
  subject: Subject;
  tests: TestSummary[];
};

export function groupTestsBySubject(tests: TestSummary[]): SubjectTestGroup[] {
  const groupsBySubjectId = new Map<number, SubjectTestGroup>();

  for (const test of tests) {
    const group = groupsBySubjectId.get(test.subject.id) ?? { subject: test.subject, tests: [] };
    group.tests.push(test);
    groupsBySubjectId.set(test.subject.id, group);
  }

  return [...groupsBySubjectId.values()];
}
