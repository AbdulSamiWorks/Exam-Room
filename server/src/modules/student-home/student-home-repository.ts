import type { AttemptStatus, FinishReason, TestKind } from '@exam-room/shared';
import type { Database } from '../../database/connection.js';
import { chapterTagsByTestId, chapterTagsQuery } from '../tests/test-chapters-repository.js';

export type StudentTestRow = {
  code: string;
  title: string;
  kind: TestKind;
  subjectId: number;
  subjectName: string;
  durationMinutes: number;
  opensAt: number | null;
  closesAt: number | null;
  attemptStatus: AttemptStatus | null;
  finishReason: FinishReason | null;
  maxMarks: number | null;
  releasedMarks: number | null;
  hasMcqResult: boolean;
  chapterNames: string[];
  bountyNote: string;
  bountyPoints: number;
};

export async function listTestsOfStudent(
  database: Database,
  classId: number,
  studentId: number,
): Promise<StudentTestRow[]> {
  const [testRows, tagRows] = await database.batch(
    [
      {
        sql: `SELECT tests.id, tests.code, tests.title, tests.kind, tests.duration_minutes, tests.opens_at,
                 tests.closes_at, tests.max_marks, tests.results_released_at,
                 tests.bounty_note, tests.bounty_points, tests.instant_mcq_result,
                 tests.question_count,
                 subjects.id AS subject_id, subjects.name AS subject_name,
                 attempts.status AS attempt_status,
                 attempts.finish_reason, attempts.total_marks
          FROM tests
          JOIN subjects ON subjects.id = tests.subject_id
          LEFT JOIN attempts ON attempts.test_id = tests.id AND attempts.student_id = ?
          WHERE subjects.class_id = ?`,
        args: [studentId, classId],
      },
      chapterTagsQuery({ classId }),
    ],
    'read',
  );
  const tagsByTestId = chapterTagsByTestId(tagRows?.rows ?? []);
  return (testRows?.rows ?? []).map((row) => ({
    code: String(row.code),
    title: String(row.title),
    kind: String(row.kind) as TestKind,
    subjectId: Number(row.subject_id),
    subjectName: String(row.subject_name),
    durationMinutes: Number(row.duration_minutes),
    opensAt: row.opens_at === null ? null : Number(row.opens_at),
    closesAt: row.closes_at === null ? null : Number(row.closes_at),
    attemptStatus:
      row.attempt_status === null ? null : (String(row.attempt_status) as AttemptStatus),
    finishReason: row.finish_reason === null ? null : (String(row.finish_reason) as FinishReason),
    maxMarks: row.max_marks === null ? null : Number(row.max_marks),
    releasedMarks:
      row.results_released_at === null || row.total_marks === null ? null : Number(row.total_marks),
    hasMcqResult:
      Number(row.instant_mcq_result) === 1 &&
      Number(row.question_count) > 0 &&
      row.attempt_status === 'submitted',
    chapterNames: (tagsByTestId.get(Number(row.id)) ?? []).map((tag) => tag.name),
    bountyNote: String(row.bounty_note),
    bountyPoints: Number(row.bounty_points),
  }));
}
