import type { Chapter } from '@exam-room/shared';
import type { Row } from '@libsql/client';
import type { Database } from '../../database/connection.js';
import { placeholdersFor, requireFirstRow } from '../../database/query-helpers.js';

export type NewChapter = {
  subjectId: number;
  name: string;
  createdAt: number;
};

const CHAPTER_COLUMNS = 'id, subject_id, name, position';

export async function findChapterById(
  database: Database,
  chapterId: number,
): Promise<Chapter | undefined> {
  const { rows } = await database.execute({
    sql: `SELECT ${CHAPTER_COLUMNS} FROM chapters WHERE id = ?`,
    args: [chapterId],
  });
  const [row] = rows;
  return row ? toChapter(row) : undefined;
}

export async function insertChapter(database: Database, newChapter: NewChapter): Promise<Chapter> {
  const result = await database.execute({
    sql: `INSERT INTO chapters (subject_id, name, position, created_at)
          SELECT ?, ?, COALESCE(MAX(position), 0) + 1, ? FROM chapters WHERE subject_id = ?
          RETURNING ${CHAPTER_COLUMNS}`,
    args: [newChapter.subjectId, newChapter.name, newChapter.createdAt, newChapter.subjectId],
  });
  return toChapter(requireFirstRow(result));
}

export async function renameChapter(
  database: Database,
  chapterId: number,
  name: string,
): Promise<void> {
  await database.execute({
    sql: 'UPDATE chapters SET name = ? WHERE id = ?',
    args: [name, chapterId],
  });
}

export async function listChapterIdsOfSubject(
  database: Database,
  subjectId: number,
): Promise<number[]> {
  const { rows } = await database.execute({
    sql: 'SELECT id FROM chapters WHERE subject_id = ? ORDER BY position, id',
    args: [subjectId],
  });
  return rows.map((row) => Number(row.id));
}

export async function findChapterIdsInSubject(
  database: Database,
  subjectId: number,
  chapterIds: readonly number[],
): Promise<number[]> {
  if (chapterIds.length === 0) return [];
  const { rows } = await database.execute({
    sql: `SELECT id FROM chapters
          WHERE subject_id = ? AND id IN (${placeholdersFor(chapterIds)})`,
    args: [subjectId, ...chapterIds],
  });
  return rows.map((row) => Number(row.id));
}

export async function saveChapterOrder(
  database: Database,
  subjectId: number,
  orderedChapterIds: readonly number[],
): Promise<void> {
  await database.batch(
    orderedChapterIds.map((chapterId, index) => ({
      sql: 'UPDATE chapters SET position = ? WHERE id = ? AND subject_id = ?',
      args: [index + 1, chapterId, subjectId],
    })),
    'write',
  );
}

export async function deleteChapterWithTags(database: Database, chapterId: number): Promise<void> {
  await database.batch(
    [
      { sql: 'DELETE FROM test_chapters WHERE chapter_id = ?', args: [chapterId] },
      { sql: 'DELETE FROM chapters WHERE id = ?', args: [chapterId] },
    ],
    'write',
  );
}

function toChapter(row: Row): Chapter {
  return {
    id: Number(row.id),
    subjectId: Number(row.subject_id),
    name: String(row.name),
    position: Number(row.position),
  };
}
