import type { Subject } from '@exam-room/shared';
import type { Row } from '@libsql/client';
import type { Database } from '../../database/connection.js';
import { requireFirstRow } from '../../database/query-helpers.js';

export async function listSubjects(database: Database): Promise<Subject[]> {
  const { rows } = await database.execute('SELECT id, name FROM subjects ORDER BY name');
  return rows.map(toSubject);
}

export async function findSubjectById(
  database: Database,
  subjectId: number,
): Promise<Subject | undefined> {
  const { rows } = await database.execute({
    sql: 'SELECT id, name FROM subjects WHERE id = ?',
    args: [subjectId],
  });
  const [row] = rows;
  return row ? toSubject(row) : undefined;
}

export async function insertSubject(
  database: Database,
  name: string,
  createdAt: number,
): Promise<Subject> {
  const result = await database.execute({
    sql: 'INSERT INTO subjects (name, created_at) VALUES (?, ?) RETURNING id, name',
    args: [name, createdAt],
  });
  return toSubject(requireFirstRow(result));
}

function toSubject(row: Row): Subject {
  return {
    id: Number(row.id),
    name: String(row.name),
  };
}
