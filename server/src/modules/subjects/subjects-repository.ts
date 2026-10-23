import type { Subject } from '@exam-room/shared';
import type { Row } from '@libsql/client';
import type { Database } from '../../database/connection.js';
import { requireFirstRow } from '../../database/query-helpers.js';

export type NewSubject = {
  classId: number;
  name: string;
  createdAt: number;
};

const SUBJECT_COLUMNS = 'id, class_id, name';

export async function findSubjectById(
  database: Database,
  subjectId: number,
): Promise<Subject | undefined> {
  const { rows } = await database.execute({
    sql: `SELECT ${SUBJECT_COLUMNS} FROM subjects WHERE id = ?`,
    args: [subjectId],
  });
  const [row] = rows;
  return row ? toSubject(row) : undefined;
}

export async function insertSubject(database: Database, newSubject: NewSubject): Promise<Subject> {
  const result = await database.execute({
    sql: `INSERT INTO subjects (class_id, name, created_at) VALUES (?, ?, ?)
          RETURNING ${SUBJECT_COLUMNS}`,
    args: [newSubject.classId, newSubject.name, newSubject.createdAt],
  });
  return toSubject(requireFirstRow(result));
}

export async function saveSubject(database: Database, subject: Subject): Promise<void> {
  await database.execute({
    sql: 'UPDATE subjects SET class_id = ?, name = ? WHERE id = ?',
    args: [subject.classId, subject.name, subject.id],
  });
}

export async function countTestsOfSubject(database: Database, subjectId: number): Promise<number> {
  const result = await database.execute({
    sql: 'SELECT COUNT(*) AS test_count FROM tests WHERE subject_id = ?',
    args: [subjectId],
  });
  return Number(requireFirstRow(result).test_count);
}

export async function deleteSubjectWithChapters(
  database: Database,
  subjectId: number,
): Promise<void> {
  await database.batch(
    [
      {
        sql: `DELETE FROM test_chapters
              WHERE chapter_id IN (SELECT id FROM chapters WHERE subject_id = ?)`,
        args: [subjectId],
      },
      { sql: 'DELETE FROM chapters WHERE subject_id = ?', args: [subjectId] },
      { sql: 'DELETE FROM subjects WHERE id = ?', args: [subjectId] },
    ],
    'write',
  );
}

export async function moveTestsToSubject(
  database: Database,
  fromSubjectId: number,
  toSubjectId: number,
): Promise<number> {
  const [, movedTests] = await database.batch(
    [
      {
        sql: `DELETE FROM test_chapters
              WHERE test_id IN (SELECT id FROM tests WHERE subject_id = ?)`,
        args: [fromSubjectId],
      },
      {
        sql: 'UPDATE tests SET subject_id = ? WHERE subject_id = ?',
        args: [toSubjectId, fromSubjectId],
      },
    ],
    'write',
  );
  return movedTests?.rowsAffected ?? 0;
}

function toSubject(row: Row): Subject {
  return {
    id: Number(row.id),
    classId: Number(row.class_id),
    name: String(row.name),
  };
}
