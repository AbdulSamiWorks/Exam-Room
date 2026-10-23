import type { PublicTest, StudentAttempt } from '@exam-room/shared';
import type { Database } from '../../database/connection.js';
import { availabilityAt } from '../tests/test-availability.js';
import type { TestRecord } from '../tests/test-record.js';
import { findTestById, listPageSizes } from '../tests/tests-repository.js';
import type { AttemptRecord } from './attempt-record.js';
import { exitsUsed } from './attempt-rules.js';

export function toPublicTest(test: TestRecord, currentTime: number): PublicTest {
  return {
    code: test.code,
    title: test.title,
    subjectName: test.subject.name,
    durationMinutes: test.durationMinutes,
    allowedExits: test.allowedExits,
    leaveRule: test.leaveRule,
    pageCount: test.pageCount,
    opensAt: test.opensAt,
    closesAt: test.closesAt,
    availability: availabilityAt(test, currentTime),
  };
}

export async function findTestOfAttempt(
  database: Database,
  attempt: AttemptRecord,
): Promise<TestRecord> {
  const test = await findTestById(database, attempt.testId);
  if (!test) throw new Error(`Test ${attempt.testId} of attempt ${attempt.id} is missing.`);
  return test;
}

export async function buildStudentAttempt(
  database: Database,
  attempt: AttemptRecord,
  test: TestRecord,
  serverTime: number,
): Promise<StudentAttempt> {
  return {
    status: attempt.status,
    finishReason: attempt.finishReason,
    studentName: attempt.studentName,
    rollNumber: attempt.rollNumber,
    test: toPublicTest(test, serverTime),
    pageSizes: await listPageSizes(database, test.id),
    startedAt: attempt.startedAt,
    deadlineAt: attempt.deadlineAt,
    exitsUsed: exitsUsed(attempt),
    serverTime,
  };
}
