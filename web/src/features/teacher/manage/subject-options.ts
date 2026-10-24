import type { ClassSummary } from '@exam-room/shared';

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

export function otherSubjectOptions(
  classes: readonly ClassSummary[],
  subjectId: number,
): SubjectOption[] {
  return subjectOptionsOf(classes).filter((option) => option.subjectId !== subjectId);
}
