import type { AttemptStatus, FinishReason } from './attempts.js';
import type { StudentProfile } from './student-auth.js';
import type { TestAvailability, TestKind, TestSchedule } from './tests.js';

export type StudentTestCard = TestSchedule & {
  code: string;
  title: string;
  kind: TestKind;
  subjectId: number;
  subjectName: string;
  durationMinutes: number;
  availability: TestAvailability;
  attemptStatus: AttemptStatus | null;
  finishReason: FinishReason | null;
  maxMarks: number | null;
  releasedMarks: number | null;
  hasMcqResult: boolean;
  chapterNames: string[];
  bountyNote: string;
  bountyPoints: number;
};

export type ClassLeader = {
  name: string;
  points: number;
};

export type StudentHomeResponse = {
  student: StudentProfile;
  tests: StudentTestCard[];
  points: number;
  classLeaders: ClassLeader[];
  serverTime: number;
};
