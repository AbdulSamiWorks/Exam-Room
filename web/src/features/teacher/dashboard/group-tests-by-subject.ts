import type { TestKind, TestSummary } from '@exam-room/shared';
import { compareNaturally } from '../../../lib/natural-order';
import { subjectLabel } from '../manage/subject-options';

export type SubjectTestGroup = {
  subjectId: number;
  heading: string;
  tests: TestSummary[];
};

export function groupTestsBySubject(
  tests: readonly TestSummary[],
  showsClassName: boolean,
): SubjectTestGroup[] {
  const groupsBySubjectId = new Map<number, SubjectTestGroup & { sortKey: [string, string] }>();

  for (const test of tests) {
    const group = groupsBySubjectId.get(test.subject.id) ?? {
      subjectId: test.subject.id,
      heading: subjectLabel(test.subject.name, test.schoolClass.name, showsClassName),
      tests: [],
      sortKey: [test.schoolClass.name, test.subject.name],
    };
    group.tests.push(test);
    groupsBySubjectId.set(test.subject.id, group);
  }

  return [...groupsBySubjectId.values()]
    .sort(
      (first, second) =>
        compareNaturally(first.sortKey[0], second.sortKey[0]) ||
        compareNaturally(first.sortKey[1], second.sortKey[1]),
    )
    .map(({ sortKey: _sortKey, ...group }) => group);
}

export function testsOfKind(
  tests: readonly TestSummary[],
  kind: TestKind | undefined,
): TestSummary[] {
  return kind === undefined ? [...tests] : tests.filter((test) => test.kind === kind);
}
