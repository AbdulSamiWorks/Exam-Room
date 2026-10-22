import type { TestSummary } from '@exam-room/shared';
import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/connection.js';
import { isUniqueConstraintError } from '../../database/query-helpers.js';
import { HttpError } from '../../lib/http-errors.js';
import type { AttemptChange, AttemptRecord } from './attempt-record.js';
import { applyTimeLimit, resumeOnNewDevice } from './attempt-rules.js';
import {
  findAttemptById,
  findAttemptByRollNumber,
  insertAttempt,
  saveAttemptChange,
} from './attempts-repository.js';
import { comparisonKey, tidyText } from './student-identity.js';

const MAX_SAVE_ATTEMPTS = 3;
const MILLISECONDS_PER_MINUTE = 60_000;

export type StartAttemptInput = {
  test: TestSummary;
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

    const latest = await findAttemptById(database, current.id);
    if (!latest) throw new Error(`Attempt ${current.id} disappeared while being updated.`);
    current = latest;
  }

  throw new Error(`Attempt ${knownAttempt.id} kept changing while being updated.`);
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
    (await tryInsertAttempt(database, input, rollNumberKey));

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
    resumeOnNewDevice(current, input.tokenHash, input.test.allowedExits, {
      clientExitId: `device-change-${randomUUID()}`,
      reason: 'device_change',
      leftAt: input.currentTime,
      returnedAt: input.currentTime,
      awayMs: 0,
    }),
  );
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
