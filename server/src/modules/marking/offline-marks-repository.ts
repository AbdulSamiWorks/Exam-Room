import type { OfflineMarkRow } from '@exam-room/shared';
import type { Database } from '../../database/connection.js';
import { comparisonKey, compareNaturally } from '../../lib/text.js';

export type OfflineMarkToSave = {
  studentId: number;
  studentName: string;
  rollNumber: string;
  marks: number | null;
};

export async function listOfflineMarks(
  database: Database,
  classId: number,
  testId: number,
): Promise<OfflineMarkRow[]> {
  const { rows } = await database.execute({
    sql: `SELECT students.id, students.name, students.roll_no, attempts.total_marks
          FROM students
          LEFT JOIN attempts ON attempts.student_id = students.id AND attempts.test_id = ?
          WHERE students.class_id = ?`,
    args: [testId, classId],
  });
  return rows
    .map((row) => ({
      studentId: Number(row.id),
      name: String(row.name),
      rollNumber: String(row.roll_no),
      marks: row.total_marks === null ? null : Number(row.total_marks),
    }))
    .sort((first, second) => compareNaturally(first.rollNumber, second.rollNumber));
}

export async function saveOfflineMarks(
  database: Database,
  testId: number,
  marks: readonly OfflineMarkToSave[],
  enteredAt: number,
): Promise<void> {
  await database.batch(
    marks.map((mark) =>
      mark.marks === null
        ? {
            sql: `DELETE FROM attempts
                  WHERE test_id = ? AND student_id = ? AND token_hash IS NULL`,
            args: [testId, mark.studentId],
          }
        : {
            sql: `INSERT INTO attempts
                    (test_id, student_id, student_name, roll_no, roll_no_key, token_hash, status,
                     finish_reason, started_at, deadline_at, finished_at, auto_marks,
                     written_marks, total_marks)
                  VALUES (?, ?, ?, ?, ?, NULL, 'submitted', 'teacher', ?, ?, ?, 0, ?, ?)
                  ON CONFLICT (test_id, student_id) DO UPDATE SET
                    written_marks = excluded.written_marks,
                    total_marks = excluded.total_marks`,
            args: [
              testId,
              mark.studentId,
              mark.studentName,
              mark.rollNumber,
              comparisonKey(mark.rollNumber),
              enteredAt,
              enteredAt,
              enteredAt,
              mark.marks,
              mark.marks,
            ],
          },
    ),
    'write',
  );
}
