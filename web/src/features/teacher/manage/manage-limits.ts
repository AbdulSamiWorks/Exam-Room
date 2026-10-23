import type { ChapterLimits, ClassLimits, SubjectLimits } from '@exam-room/shared';

export const classLimits: ClassLimits = {
  maxNameLength: 40,
};

export const subjectLimits: SubjectLimits = {
  maxNameLength: 50,
};

export const chapterLimits: ChapterLimits = {
  maxNameLength: 80,
  maxChaptersPerSubject: 100,
};
