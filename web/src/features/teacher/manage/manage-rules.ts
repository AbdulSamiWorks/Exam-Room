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

export function classDeletionBlocker(schoolClass: ClassSummary): string | undefined {
  const contents = [
    schoolClass.studentCount > 0 ? countOf(schoolClass.studentCount, 'student') : undefined,
    schoolClass.subjects.length > 0 ? countOf(schoolClass.subjects.length, 'subject') : undefined,
  ].filter((part) => part !== undefined);
  if (contents.length === 0) return undefined;
  return `${schoolClass.name} still has ${joinWithAnd(contents)}. Move or delete them first.`;
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
