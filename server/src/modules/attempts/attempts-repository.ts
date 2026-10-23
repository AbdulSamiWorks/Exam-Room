import type { AttemptStatus, FinishReason, NotStartedStudent } from '@exam-room/shared';
import type { Row } from '@libsql/client';
import type { Database } from '../../database/connection.js';
import { requireFirstRow } from '../../database/query-helpers.js';
import { compareNaturally } from '../../lib/text.js';
import type { AttemptChange, AttemptRecord, ExitEvent } from './attempt-record.js';
import type { StartTimes } from './attempt-rules.js';

export type NewAttempt = {
  testId: number;
  studentId: number;
  studentName: string;
  rollNumber: string;
  rollNumberKey: string;
  tokenHash: string;
  status: Extract<AttemptStatus, 'waiting' | 'in_progress'>;
  startedAt: number;
  deadlineAt: number;
};

const ATTEMPT_COLUMNS = `
  id, test_id, student_id, student_name, roll_no, token_hash, status, finish_reason,
  started_at, deadline_at, finished_at, exit_count, forgiven_exits, total_marks, version`;

export async function insertAttempt(
  database: Database,
  newAttempt: NewAttempt,
): Promise<AttemptRecord> {
  const result = await database.execute({
    sql: `INSERT INTO attempts
            (test_id, student_id, student_name, roll_no, roll_no_key, token_hash, status,
             started_at, deadline_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING ${ATTEMPT_COLUMNS}`,
    args: [
      newAttempt.testId,
      newAttempt.studentId,
      newAttempt.studentName,
      newAttempt.rollNumber,
      newAttempt.rollNumberKey,
      newAttempt.tokenHash,
      newAttempt.status,
      newAttempt.startedAt,
      newAttempt.deadlineAt,
    ],
  });
  return toAttemptRecord(requireFirstRow(result));
}

export async function startWaitingAttempts(
  database: Database,
  testId: number,
  { startedAt, deadlineAt }: StartTimes,
): Promise<number> {
  const result = await database.execute({
    sql: `UPDATE attempts
          SET status = 'in_progress', started_at = ?, deadline_at = ?, version = version + 1
          WHERE test_id = ? AND status = 'waiting'`,
    args: [startedAt, deadlineAt, testId],
  });
  return result.rowsAffected;
}

export async function findAttemptById(
  database: Database,
  attemptId: number,
): Promise<AttemptRecord | undefined> {
  return findOneAttempt(database, 'id = ?', [attemptId]);
}

export async function findAttemptByTokenHash(
  database: Database,
  tokenHash: string,
): Promise<AttemptRecord | undefined> {
  return findOneAttempt(database, 'token_hash = ?', [tokenHash]);
}

export async function findAttemptOfStudent(
  database: Database,
  testId: number,
  studentId: number,
): Promise<AttemptRecord | undefined> {
  return findOneAttempt(database, 'test_id = ? AND student_id = ?', [testId, studentId]);
}

export async function saveAttemptChange(
  database: Database,
  expectedVersion: number,
  { attempt, newExit }: AttemptChange,
): Promise<boolean> {
  const transaction = await database.transaction('write');
  try {
    const update = await transaction.execute({
      sql: `UPDATE attempts
            SET token_hash = ?, status = ?, finish_reason = ?, finished_at = ?,
                exit_count = ?, forgiven_exits = ?, version = version + 1
            WHERE id = ? AND version = ?`,
      args: [
        attempt.tokenHash,
        attempt.status,
        attempt.finishReason,
        attempt.finishedAt,
        attempt.exitCount,
        attempt.forgivenExits,
        attempt.id,
        expectedVersion,
      ],
    });
    if (update.rowsAffected === 0) return false;

    if (newExit) {
      await transaction.execute({
        sql: `INSERT INTO exits (attempt_id, client_exit_id, reason, left_at, returned_at, away_ms)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          attempt.id,
          newExit.clientExitId,
          newExit.reason,
          newExit.leftAt,
          newExit.returnedAt,
          newExit.awayMs,
        ],
      });
    }

    await transaction.commit();
    return true;
  } finally {
    transaction.close();
  }
}

export async function hasExit(
  database: Database,
  attemptId: number,
  clientExitId: string,
): Promise<boolean> {
  const { rows } = await database.execute({
    sql: 'SELECT 1 FROM exits WHERE attempt_id = ? AND client_exit_id = ?',
    args: [attemptId, clientExitId],
  });
  return rows.length > 0;
}

export async function closeExit(
  database: Database,
  attemptId: number,
  clientExitId: string,
  returnedAt: number,
): Promise<void> {
  await database.execute({
    sql: `UPDATE exits
          SET returned_at = ?, away_ms = MAX(0, ? - left_at)
          WHERE attempt_id = ? AND client_exit_id = ? AND returned_at IS NULL`,
    args: [returnedAt, returnedAt, attemptId, clientExitId],
  });
}

export async function deleteAttemptWithExits(database: Database, attemptId: number): Promise<void> {
  await database.batch(
    [
      { sql: 'DELETE FROM exits WHERE attempt_id = ?', args: [attemptId] },
      { sql: 'DELETE FROM answers WHERE attempt_id = ?', args: [attemptId] },
      { sql: 'DELETE FROM answer_photos WHERE attempt_id = ?', args: [attemptId] },
      { sql: 'DELETE FROM question_marks WHERE attempt_id = ?', args: [attemptId] },
      { sql: 'DELETE FROM attempts WHERE id = ?', args: [attemptId] },
    ],
    'write',
  );
}

export async function listAttemptsOfTest(
  database: Database,
  testId: number,
): Promise<AttemptRecord[]> {
  const { rows } = await database.execute({
    sql: `SELECT ${ATTEMPT_COLUMNS} FROM attempts WHERE test_id = ? ORDER BY started_at, id`,
    args: [testId],
  });
  return rows.map(toAttemptRecord);
}

export async function listExitsOfTest(
  database: Database,
  testId: number,
): Promise<Map<number, ExitEvent[]>> {
  const { rows } = await database.execute({
    sql: `SELECT exits.attempt_id, exits.client_exit_id, exits.reason,
                 exits.left_at, exits.returned_at, exits.away_ms
          FROM exits
          JOIN attempts ON attempts.id = exits.attempt_id
          WHERE attempts.test_id = ?
          ORDER BY exits.left_at, exits.id`,
    args: [testId],
  });

  const exitsByAttemptId = new Map<number, ExitEvent[]>();
  for (const row of rows) {
    const attemptId = Number(row.attempt_id);
    const attemptExits = exitsByAttemptId.get(attemptId) ?? [];
    attemptExits.push(toExitEvent(row));
    exitsByAttemptId.set(attemptId, attemptExits);
  }
  return exitsByAttemptId;
}

export async function listStudentsWithoutAttempt(
  database: Database,
  classId: number,
  testId: number,
): Promise<NotStartedStudent[]> {
  const { rows } = await database.execute({
    sql: `SELECT id, name, roll_no FROM students
          WHERE class_id = ?
            AND id NOT IN (SELECT student_id FROM attempts
                           WHERE test_id = ? AND student_id IS NOT NULL)`,
    args: [classId, testId],
  });
  return rows
    .map((row) => ({
      studentId: Number(row.id),
      name: String(row.name),
      rollNumber: String(row.roll_no),
    }))
    .sort((first, second) => compareNaturally(first.rollNumber, second.rollNumber));
}

function toExitEvent(row: Row): ExitEvent {
  return {
    clientExitId: String(row.client_exit_id),
    reason: String(row.reason) as ExitEvent['reason'],
    leftAt: Number(row.left_at),
    returnedAt: row.returned_at === null ? null : Number(row.returned_at),
    awayMs: row.away_ms === null ? null : Number(row.away_ms),
  };
}

async function findOneAttempt(
  database: Database,
  condition: string,
  args: Array<string | number>,
): Promise<AttemptRecord | undefined> {
  const { rows } = await database.execute({
    sql: `SELECT ${ATTEMPT_COLUMNS} FROM attempts WHERE ${condition}`,
    args,
  });
  const [row] = rows;
  return row ? toAttemptRecord(row) : undefined;
}

function toAttemptRecord(row: Row): AttemptRecord {
  return {
    id: Number(row.id),
    testId: Number(row.test_id),
    studentId: row.student_id === null ? null : Number(row.student_id),
    studentName: String(row.student_name),
    rollNumber: String(row.roll_no),
    tokenHash: row.token_hash === null ? null : String(row.token_hash),
    status: String(row.status) as AttemptStatus,
    finishReason: row.finish_reason === null ? null : (String(row.finish_reason) as FinishReason),
    startedAt: Number(row.started_at),
    deadlineAt: Number(row.deadline_at),
    finishedAt: row.finished_at === null ? null : Number(row.finished_at),
    exitCount: Number(row.exit_count),
    forgivenExits: Number(row.forgiven_exits),
    totalMarks: row.total_marks === null ? null : Number(row.total_marks),
    version: Number(row.version),
  };
}
