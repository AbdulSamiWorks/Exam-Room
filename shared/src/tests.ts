import type { ChapterTag } from './chapters.js';
import type { SchoolClass } from './classes.js';
import type { PaperKind, WrittenAnswers } from './paper.js';
import type { Subject } from './subjects.js';

export type AllowedExits = 0 | 1 | 2;

export type LeaveRule = 'lock' | 'finish';

export type TestKind = 'test' | 'quiz' | 'assignment';

export type TestAvailability = 'not_open' | 'scheduled' | 'open' | 'closed';

export type TestSchedule = {
  opensAt: number | null;
  closesAt: number | null;
};

export type TestSummary = TestSchedule & {
  id: number;
  code: string;
  kind: TestKind;
  title: string;
  schoolClass: SchoolClass;
  subject: Subject;
  chapters: ChapterTag[];
  durationMinutes: number;
  allowedExits: AllowedExits;
  leaveRule: LeaveRule;
  paperKind: PaperKind;
  pageCount: number;
  questionCount: number;
  maxMarks: number | null;
  writtenAnswers: WrittenAnswers;
  bountyNote: string;
  bountyPoints: number;
  waitingRoom: boolean;
  instantMcqResult: boolean;
  resultsReleasedAt: number | null;
  studentCount: number;
  createdAt: number;
  availability: TestAvailability;
};

export type TestResponse = {
  test: TestSummary;
};

export type TestListResponse = {
  tests: TestSummary[];
};

export type TestSettings = {
  subjectId: number;
  kind: TestKind;
  chapterIds: number[];
  title: string;
  durationMinutes: number;
  allowedExits: AllowedExits;
  leaveRule: LeaveRule;
  writtenAnswers: WrittenAnswers;
  bountyNote: string;
  bountyPoints: number;
  waitingRoom: boolean;
  instantMcqResult: boolean;
};

export type UpdateTestRequest = Partial<TestSettings>;

export type ScheduleTestRequest = {
  opensAt: number;
  closesAt: number | null;
};

export type CreateTestFormField =
  keyof TestSettings | 'paperKind' | 'maxMarks' | 'pages' | 'paper' | 'answerKey' | 'paperImages';

export type PaperFormField = 'paper' | 'answerKey' | 'paperImages';

export type TestLimits = {
  maxTitleLength: 120;
  minDurationMinutes: 1;
  maxDurationMinutes: 600;
  maxPages: 30;
  maxPageImageBytes: 3_000_000;
  maxChaptersPerTest: 20;
  maxBountyNoteLength: 200;
  maxBountyPoints: 1000;
  maxOfflineMarks: 1000;
};
