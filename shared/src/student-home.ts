import type { AttemptStatus, FinishReason } from './attempts.js';
import type { StudentProfile } from './student-auth.js';
import type { TestAvailability, TestKind, TestSchedule } from './tests.js';

export type StudentTestCard = TestSchedule & {
  code: string;
  title: string;
  kind: TestKind;
  subjectName: string;
  durationMinutes: number;
  availability: TestAvailability;
  attemptStatus: AttemptStatus | null;
  finishReason: FinishReason | null;
};

export type StudentHomeResponse = {
  student: StudentProfile;
  tests: StudentTestCard[];
  serverTime: number;
};
