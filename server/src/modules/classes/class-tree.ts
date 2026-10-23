import type { ChapterSummary, ClassSubjectSummary, ClassSummary } from '@exam-room/shared';
import { groupBy } from '../../lib/collections.js';
import { compareNaturally } from '../../lib/text.js';

export type ClassWithStudentCount = Omit<ClassSummary, 'subjects'>;

export type SubjectWithTestCount = Omit<ClassSubjectSummary, 'chapters'> & {
  classId: number;
};

export type ChapterWithTestCount = ChapterSummary & {
  subjectId: number;
};

export type ClassTreeRows = {
  classes: ClassWithStudentCount[];
  subjects: SubjectWithTestCount[];
  chapters: ChapterWithTestCount[];
};

export function buildClassTree({ classes, subjects, chapters }: ClassTreeRows): ClassSummary[] {
  const chaptersBySubjectId = groupBy(chapters, (chapter) => chapter.subjectId);
  const subjectsByClassId = groupBy(subjects, (subject) => subject.classId);

  return [...classes].sort(byName).map((schoolClass) => ({
    ...schoolClass,
    subjects: (subjectsByClassId.get(schoolClass.id) ?? [])
      .sort(byName)
      .map(({ classId: _classId, ...subject }) => ({
        ...subject,
        chapters: (chaptersBySubjectId.get(subject.id) ?? [])
          .sort(byPosition)
          .map(({ subjectId: _subjectId, ...chapter }) => chapter),
      })),
  }));
}

function byName(first: { name: string }, second: { name: string }): number {
  return compareNaturally(first.name, second.name);
}

function byPosition(first: ChapterSummary, second: ChapterSummary): number {
  return first.position - second.position || first.id - second.id;
}
