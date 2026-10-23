import type { AttemptStatus, FinishReason, TestKind } from '@exam-room/shared';
import type { Database } from '../../database/connection.js';

export type StudentTestRow = {
  code: string;
  title: string;
  kind: TestKind;
  subjectName: string;
  durationMinutes: number;
  opensAt: number | null;
  closesAt: number | null;
  attemptStatus: AttemptStatus | null;
  finishReason: FinishReason | null;
};

export async function listTestsOfStudent(
  database: Database,
  classId: number,
  studentId: number,
): Promise<StudentTestRow[]> {
  const { rows } = await database.execute({
    sql: `SELECT tests.code, tests.title, tests.kind, tests.duration_minutes, tests.opens_at,
                 tests.closes_at, subjects.name AS subject_name,
                 attempts.status AS attempt_status, attempts.finish_reason
          FROM tests
          JOIN subjects ON subjects.id = tests.subject_id
          LEFT JOIN attempts ON attempts.test_id = tests.id AND attempts.student_id = ?
          WHERE subjects.class_id = ?`,
    args: [studentId, classId],
  });
  return rows.map((row) => ({
    code: String(row.code),
    title: String(row.title),
    kind: String(row.kind) as TestKind,
    subjectName: String(row.subject_name),
    durationMinutes: Number(row.duration_minutes),
    opensAt: row.opens_at === null ? null : Number(row.opens_at),
    closesAt: row.closes_at === null ? null : Number(row.closes_at),
    attemptStatus:
      row.attempt_status === null ? null : (String(row.attempt_status) as AttemptStatus),
    finishReason: row.finish_reason === null ? null : (String(row.finish_reason) as FinishReason),
  }));
}
