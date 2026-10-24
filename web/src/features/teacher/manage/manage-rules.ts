import type {
  ChapterSummary,
  ClassSubjectSummary,
  ClassSummary,
  Student,
  StudentWithPin,
  UpdateStudentRequest,
} from '@exam-room/shared';
import { countOf, joinWithAnd } from '../../../lib/text';

export type MoveDirection = 'up' | 'down';

export type StudentFormValues = {
  rollNumber: string;
  name: string;
  classId: number;
};

export function isEmptyClass(schoolClass: ClassSummary): boolean {
  return schoolClass.studentCount === 0 && schoolClass.subjects.length === 0;
}

export function describeClassDeletion(schoolClass: ClassSummary): string {
  if (isEmptyClass(schoolClass)) {
    return 'The class is empty, so nothing else is deleted. This cannot be undone.';
  }
  const subjects = schoolClass.subjects;
  const testCount = subjects.reduce((total, subject) => total + subject.testCount, 0);
  const chapterCount = subjects.reduce((total, subject) => total + subject.chapters.length, 0);
  const subjectDetails = [
    chapterCount > 0 && countOf(chapterCount, 'chapter'),
    testCount > 0 && `${countOf(testCount, 'test')} with all their results and photos`,
  ].filter((part): part is string => Boolean(part));
  const subjectsPart =
    subjectDetails.length > 0
      ? `${countOf(subjects.length, 'subject')} (${joinWithAnd(subjectDetails)})`
      : countOf(subjects.length, 'subject');
  const parts = [
    subjects.length > 0 && subjectsPart,
    schoolClass.studentCount > 0 &&
      `${countOf(schoolClass.studentCount, 'student')} with their PINs and points`,
  ].filter((part): part is string => Boolean(part));
  return `This also deletes ${joinWithAnd(parts)}. Results the students have in other classes stay. This cannot be undone.`;
}

export function subjectDeletionBlocker(subject: ClassSubjectSummary): string | undefined {
  if (subject.testCount === 0) return undefined;
  return `${subject.name} still has ${countOf(subject.testCount, 'test')}. Move them to another subject or delete them first.`;
}

export function describeSubjectDeletion(subject: ClassSubjectSummary): string {
  const chapters = subject.chapters.length;
  const goesWithIt =
    chapters > 0 ? ` Its ${countOf(chapters, 'chapter')} will be deleted too.` : '';
  return `Delete ${subject.name}?${goesWithIt} This cannot be undone.`;
}

export function describeChapterDeletion(chapter: ChapterSummary): string {
  if (chapter.testCount === 0) return `Delete the chapter ${chapter.name}?`;
  return `Delete the chapter ${chapter.name}? ${countOf(chapter.testCount, 'test')} will keep their other chapters; only this tag is removed.`;
}

export function chapterIdsAfterMove(
  chapters: readonly ChapterSummary[],
  chapterId: number,
  direction: MoveDirection,
): number[] {
  const chapterIds = chapters.map((chapter) => chapter.id);
  const index = chapterIds.indexOf(chapterId);
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= chapterIds.length) return chapterIds;

  const reordered = [...chapterIds];
  [reordered[index], reordered[targetIndex]] = [chapterIds[targetIndex] ?? chapterId, chapterId];
  return reordered;
}

export function pinListText(
  className: string,
  studentsWithPins: readonly StudentWithPin[],
): string {
  const lines = studentsWithPins.map(
    ({ student, pin }) => `Roll ${student.rollNumber} · ${student.name} · PIN ${pin}`,
  );
  return [`${className} – login PINs`, ...lines].join('\n');
}

export function describeClassContents(schoolClass: ClassSummary): string {
  return [
    countOf(schoolClass.studentCount, 'student'),
    countOf(schoolClass.subjects.length, 'subject'),
  ].join(' · ');
}

export function studentChanges(student: Student, values: StudentFormValues): UpdateStudentRequest {
  const rollNumber = values.rollNumber.trim();
  const name = values.name.trim();
  return {
    ...(rollNumber !== student.rollNumber && { rollNumber }),
    ...(name !== student.name && { name }),
    ...(values.classId !== student.classId && { classId: values.classId }),
  };
}
