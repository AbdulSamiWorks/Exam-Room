import type { PaperKind, WrittenAnswers } from './paper.js';
import type { AllowedExits, LeaveRule, TestAvailability, TestKind, TestSchedule } from './tests.js';

export type AttemptStatus = 'waiting' | 'in_progress' | 'submitted' | 'locked';

export type FinishReason = 'student' | 'time_up' | 'teacher' | 'left_test';

export type ExitReason = 'hidden' | 'blur' | 'fullscreen' | 'device_change';

export type StudentExitReason = Exclude<ExitReason, 'device_change'>;

export type PublicTest = TestSchedule & {
  code: string;
  kind: TestKind;
  title: string;
  subjectName: string;
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
  availability: TestAvailability;
};

export type PublicTestDetails = PublicTest & {
  chapterNames: string[];
};

export type PublicTestResponse = {
  test: PublicTestDetails;
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

export type AttemptExit = {
  reason: ExitReason;
  leftAt: number;
  returnedAt: number | null;
  awayMs: number;
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
  answeredCount: number;
  photoCount: number;
  totalMarks: number | null;
  exits: AttemptExit[];
};

export type NotStartedStudent = {
  studentId: number;
  name: string;
  rollNumber: string;
};

export type AttemptResultListResponse = {
  attempts: AttemptResult[];
  notStarted: NotStartedStudent[];
  serverTime: number;
};

export type AttemptResultResponse = {
  attempt: AttemptResult;
};
