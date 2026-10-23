import type { ClassSummary, TestKind, TestSummary } from '@exam-room/shared';
import { compareNaturally } from '../../../lib/natural-order';

export type SubjectTestGroup = {
  subjectId: number;
  heading: string;
  tests: TestSummary[];
};

export type SubjectOption = {
  subjectId: number;
  label: string;
};

export function subjectLabel(
  subjectName: string,
  className: string,
  showsClassName: boolean,
): string {
  return showsClassName ? `${subjectName} · ${className}` : subjectName;
}

export function subjectOptionsOf(classes: readonly ClassSummary[]): SubjectOption[] {
  const showsClassName = classes.length > 1;
  return classes.flatMap((schoolClass) =>
    schoolClass.subjects.map((subject) => ({
      subjectId: subject.id,
      label: subjectLabel(subject.name, schoolClass.name, showsClassName),
    })),
  );
}

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
