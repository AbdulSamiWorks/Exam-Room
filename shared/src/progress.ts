import type { ChapterTag } from './chapters.js';
import type { StudentProfile } from './student-auth.js';
import type { TestKind } from './tests.js';

export type ProgressResult = {
  testCode: string;
  testTitle: string;
  kind: TestKind;
  subjectId: number;
  subjectName: string;
  chapters: ChapterTag[];
  date: number;
  marks: number;
  maxMarks: number;
  isReleased: boolean;
};

export type ProgressSubject = {
  id: number;
  name: string;
  chapters: ChapterTag[];
};

export type ProgressResponse = {
  student: StudentProfile;
  subjects: ProgressSubject[];
  results: ProgressResult[];
};
