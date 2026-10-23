import type { Subject } from './subjects.js';

export type AllowedExits = 0 | 1 | 2;

export type LeaveRule = 'lock' | 'finish';

export type TestAvailability = 'not_open' | 'scheduled' | 'open' | 'closed';

export type TestSchedule = {
  opensAt: number | null;
  closesAt: number | null;
};

export type TestSummary = TestSchedule & {
  id: number;
  code: string;
  title: string;
  subject: Subject;
  durationMinutes: number;
  allowedExits: AllowedExits;
  leaveRule: LeaveRule;
  pageCount: number;
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

export type ScheduleTestRequest = {
  opensAt: number;
  closesAt: number | null;
};

export type CreateTestFormField =
  'subjectId' | 'title' | 'durationMinutes' | 'allowedExits' | 'leaveRule' | 'pages';

export type TestLimits = {
  maxTitleLength: 120;
  minDurationMinutes: 1;
  maxDurationMinutes: 600;
  maxPages: 30;
  maxPageImageBytes: 3_000_000;
};
