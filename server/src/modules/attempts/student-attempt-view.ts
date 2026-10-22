import type { PublicTest, StudentAttempt, TestSummary } from '@exam-room/shared';
import type { Database } from '../../database/connection.js';
import { findTestById, listPageSizes } from '../tests/tests-repository.js';
import type { AttemptRecord } from './attempt-record.js';
import { exitsUsed } from './attempt-rules.js';

export function toPublicTest(test: TestSummary): PublicTest {
  return {
    code: test.code,
    title: test.title,
    subjectName: test.subject.name,
    durationMinutes: test.durationMinutes,
    allowedExits: test.allowedExits,
    pageCount: test.pageCount,
  };
}

export async function findTestOfAttempt(
  database: Database,
  attempt: AttemptRecord,
): Promise<TestSummary> {
  const test = await findTestById(database, attempt.testId);
  if (!test) throw new Error(`Test ${attempt.testId} of attempt ${attempt.id} is missing.`);
  return test;
}

export async function buildStudentAttempt(
  database: Database,
  attempt: AttemptRecord,
  test: TestSummary,
  serverTime: number,
): Promise<StudentAttempt> {
  return {
    status: attempt.status,
    finishReason: attempt.finishReason,
    studentName: attempt.studentName,
    rollNumber: attempt.rollNumber,
    test: toPublicTest(test),
    pageSizes: await listPageSizes(database, test.id),
    startedAt: attempt.startedAt,
    deadlineAt: attempt.deadlineAt,
    exitsUsed: exitsUsed(attempt),
    serverTime,
  };
}
