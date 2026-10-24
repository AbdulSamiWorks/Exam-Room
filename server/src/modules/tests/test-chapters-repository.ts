import type { ChapterTag } from '@exam-room/shared';
import type { InStatement, Row } from '@libsql/client';
import type { Database } from '../../database/connection.js';
import { groupBy } from '../../lib/collections.js';

export type ChapterTagScope =
  { testId: number } | { subjectId: number } | { classId: number } | 'all tests';

const SELECT_CHAPTER_TAGS = `
  SELECT test_chapters.test_id, chapters.id, chapters.name
  FROM test_chapters
  JOIN chapters ON chapters.id = test_chapters.chapter_id`;

const CHAPTER_TAG_ORDER = 'ORDER BY chapters.position, chapters.id';

export function chapterTagsQuery(scope: ChapterTagScope): InStatement {
  if (scope === 'all tests') return `${SELECT_CHAPTER_TAGS} ${CHAPTER_TAG_ORDER}`;
  if ('testId' in scope) {
    return {
      sql: `${SELECT_CHAPTER_TAGS} WHERE test_chapters.test_id = ? ${CHAPTER_TAG_ORDER}`,
      args: [scope.testId],
    };
  }
  if ('classId' in scope) {
    return {
      sql: `${SELECT_CHAPTER_TAGS}
            WHERE chapters.subject_id IN (SELECT id FROM subjects WHERE class_id = ?)
            ${CHAPTER_TAG_ORDER}`,
      args: [scope.classId],
    };
  }
  return {
    sql: `${SELECT_CHAPTER_TAGS} WHERE chapters.subject_id = ? ${CHAPTER_TAG_ORDER}`,
    args: [scope.subjectId],
  };
}

export async function listChapterNamesOfTest(
  database: Database,
  testId: number,
): Promise<string[]> {
  const { rows } = await database.execute(chapterTagsQuery({ testId }));
  return rows.map((row) => String(row.name));
}

export function chapterTagsByTestId(rows: readonly Row[]): Map<number, ChapterTag[]> {
  const tagRows = rows.map((row) => ({
    testId: Number(row.test_id),
    tag: { id: Number(row.id), name: String(row.name) },
  }));
  const groups = groupBy(tagRows, (tagRow) => tagRow.testId);
  return new Map(
    [...groups].map(([testId, testTagRows]) => [testId, testTagRows.map(({ tag }) => tag)]),
  );
}

export function replaceChapterTagsStatements(
  testId: number,
  chapterIds: readonly number[],
): InStatement[] {
  return [
    { sql: 'DELETE FROM test_chapters WHERE test_id = ?', args: [testId] },
    ...insertChapterTagsStatements(testId, chapterIds),
  ];
}

export function insertChapterTagsStatements(
  testId: number,
  chapterIds: readonly number[],
): InStatement[] {
  return chapterIds.map((chapterId) => ({
    sql: 'INSERT INTO test_chapters (test_id, chapter_id) VALUES (?, ?)',
    args: [testId, chapterId],
  }));
}
