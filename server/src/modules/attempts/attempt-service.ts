import type { StudentExitReason } from '@exam-room/shared';
import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/connection.js';
import { isUniqueConstraintError } from '../../database/query-helpers.js';
import { forbidden, HttpError } from '../../lib/http-errors.js';
import { availabilityAt } from '../tests/test-availability.js';
import type { TestRecord } from '../tests/test-record.js';
import type { AttemptChange, AttemptRecord, ExitEvent } from './attempt-record.js';
import {
  applyTimeLimit,
  registerExit,
  resumeOnNewDevice,
  type ExitRules,
} from './attempt-rules.js';
import {
  closeExit,
  findAttemptById,
  hasExit,
  findAttemptByRollNumber,
  insertAttempt,
  saveAttemptChange,
} from './attempts-repository.js';
import { comparisonKey, tidyText } from './student-identity.js';

const MAX_SAVE_ATTEMPTS = 3;
const MILLISECONDS_PER_MINUTE = 60_000;

export type StartAttemptInput = {
  test: TestRecord;
  studentName: string;
  rollNumber: string;
  tokenHash: string;
  currentTime: number;
};

export async function changeAttempt(
  database: Database,
  knownAttempt: AttemptRecord,
  decideChange: (current: AttemptRecord) => AttemptChange,
): Promise<AttemptRecord> {
  let current = knownAttempt;

  for (let saveAttempt = 1; saveAttempt <= MAX_SAVE_ATTEMPTS; saveAttempt++) {
    const change = decideChange(current);
    if (change.attempt === current && !change.newExit) return current;

    if (await saveAttemptChange(database, current.version, change)) {
      return { ...change.attempt, version: current.version + 1 };
    }

    current = await requireAttempt(database, current.id);
  }

  throw new Error(`Attempt ${knownAttempt.id} kept changing while being updated.`);
}

export type StudentExitInput = {
  clientExitId: string;
  reason: StudentExitReason;
  exitRules: ExitRules;
};

export async function recordExit(
  database: Database,
  attempt: AttemptRecord,
  input: StudentExitInput,
  leftAt: number,
): Promise<AttemptRecord> {
  if (await hasExit(database, attempt.id, input.clientExitId)) return attempt;

  const exit: ExitEvent = {
    clientExitId: input.clientExitId,
    reason: input.reason,
    leftAt,
    returnedAt: null,
    awayMs: null,
  };
  try {
    return await changeAttempt(database, attempt, (current) =>
      registerExit(current, input.exitRules, exit),
    );
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    return requireAttempt(database, attempt.id);
  }
}

export async function recordReturn(
  database: Database,
  attempt: AttemptRecord,
  input: StudentExitInput & { awayMsClient: number },
  currentTime: number,
): Promise<AttemptRecord> {
  const estimatedLeftAt = Math.max(attempt.startedAt, currentTime - input.awayMsClient);
  const attemptAfterExit = await recordExit(database, attempt, input, estimatedLeftAt);
  await closeExit(database, attempt.id, input.clientExitId, currentTime);
  return attemptAfterExit;
}

export function enforceTimeLimit(
  database: Database,
  attempt: AttemptRecord,
  currentTime: number,
): Promise<AttemptRecord> {
  return changeAttempt(database, attempt, (current) => applyTimeLimit(current, currentTime));
}

export async function startOrResumeAttempt(
  database: Database,
  input: StartAttemptInput,
): Promise<AttemptRecord> {
  const rollNumberKey = comparisonKey(input.rollNumber);
  const existingAttempt =
    (await findAttemptByRollNumber(database, input.test.id, rollNumberKey)) ??
    (await insertAttemptIfTestIsOpen(database, input, rollNumberKey));

  if (existingAttempt.tokenHash === input.tokenHash) return existingAttempt;

  if (comparisonKey(existingAttempt.studentName) !== comparisonKey(input.studentName)) {
    throw new HttpError(
      409,
      'roll_number_taken',
      'This roll number has already been used for this test. Ask your teacher for help.',
    );
  }

  const attempt = await enforceTimeLimit(database, existingAttempt, input.currentTime);
  return changeAttempt(database, attempt, (current) =>
    resumeOnNewDevice(current, input.tokenHash, input.test, {
      clientExitId: `device-change-${randomUUID()}`,
      reason: 'device_change',
      leftAt: input.currentTime,
      returnedAt: input.currentTime,
      awayMs: 0,
    }),
  );
}

async function requireAttempt(database: Database, attemptId: number): Promise<AttemptRecord> {
  const attempt = await findAttemptById(database, attemptId);
  if (!attempt) throw new Error(`Attempt ${attemptId} is missing.`);
  return attempt;
}

function insertAttemptIfTestIsOpen(
  database: Database,
  input: StartAttemptInput,
  rollNumberKey: string,
): Promise<AttemptRecord> {
  const availability = availabilityAt(input.test, input.currentTime);
  if (availability === 'closed') {
    throw forbidden('This test is closed. New students cannot start it.', 'test_closed');
  }
  if (availability !== 'open') {
    throw forbidden('This test is not open yet. Wait for your teacher.', 'test_not_open');
  }
  return tryInsertAttempt(database, input, rollNumberKey);
}

async function tryInsertAttempt(
  database: Database,
  input: StartAttemptInput,
  rollNumberKey: string,
): Promise<AttemptRecord> {
  try {
    return await insertAttempt(database, {
      testId: input.test.id,
      studentName: tidyText(input.studentName),
      rollNumber: tidyText(input.rollNumber),
      rollNumberKey,
      tokenHash: input.tokenHash,
      startedAt: input.currentTime,
      deadlineAt: input.currentTime + input.test.durationMinutes * MILLISECONDS_PER_MINUTE,
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const attemptCreatedMeanwhile = await findAttemptByRollNumber(
      database,
      input.test.id,
      rollNumberKey,
    );
    if (!attemptCreatedMeanwhile) throw error;
    return attemptCreatedMeanwhile;
  }
}
