import type { AllowedExits, TestAvailability, TestSchedule } from './tests.js';

export type AttemptStatus = 'in_progress' | 'submitted' | 'locked';

export type FinishReason = 'student' | 'time_up';

export type ExitReason = 'hidden' | 'blur' | 'fullscreen' | 'device_change';

export type StudentExitReason = Exclude<ExitReason, 'device_change'>;

export type PublicTest = TestSchedule & {
  code: string;
  title: string;
  subjectName: string;
  durationMinutes: number;
  allowedExits: AllowedExits;
  pageCount: number;
  availability: TestAvailability;
};

export type PublicTestResponse = {
  test: PublicTest;
};

export type PageSize = {
  width: number;
  height: number;
};

export type StudentAttempt = {
  status: AttemptStatus;
  finishReason: FinishReason | null;
  studentName: string;
  rollNumber: string;
  test: PublicTest;
  pageSizes: PageSize[];
  startedAt: number;
  deadlineAt: number;
  exitsUsed: number;
  serverTime: number;
};

export type StartAttemptRequest = {
  studentName: string;
  rollNumber: string;
};

export type StartAttemptResponse = {
  attemptToken: string;
  attempt: StudentAttempt;
};

export type AttemptResponse = {
  attempt: StudentAttempt;
};

export type RecordExitRequest = {
  clientExitId: string;
  reason: StudentExitReason;
};

export type RecordReturnRequest = RecordExitRequest & {
  awayMsClient: number;
};

export type AttemptResult = {
  id: number;
  studentName: string;
  rollNumber: string;
  status: AttemptStatus;
  finishReason: FinishReason | null;
  startedAt: number;
  finishedAt: number | null;
  exitCount: number;
  forgivenExits: number;
  awayMs: number;
  isAwayNow: boolean;
};

export type AttemptResultListResponse = {
  attempts: AttemptResult[];
  serverTime: number;
};

export type AttemptResultResponse = {
  attempt: AttemptResult;
};

export type StudentLimits = {
  maxNameLength: 60;
  maxRollNumberLength: 30;
};
