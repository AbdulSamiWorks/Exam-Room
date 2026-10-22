import type { Subject } from './subjects.js';

export type AllowedExits = 0 | 1 | 2;

export type TestSummary = {
  id: number;
  code: string;
  title: string;
  subject: Subject;
  durationMinutes: number;
  allowedExits: AllowedExits;
  pageCount: number;
  createdAt: number;
};

export type TestResponse = {
  test: TestSummary;
};

export type CreateTestFormField =
  'subjectId' | 'title' | 'durationMinutes' | 'allowedExits' | 'pages';

export type TestLimits = {
  maxTitleLength: 120;
  minDurationMinutes: 1;
  maxDurationMinutes: 600;
  maxPages: 30;
  maxPageImageBytes: 3_000_000;
};
