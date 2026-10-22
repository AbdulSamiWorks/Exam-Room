import type { AllowedExits, TestSummary } from '@exam-room/shared';
import type { Row } from '@libsql/client';
import type { Database } from '../../database/connection.js';
import { requireFirstRow } from '../../database/query-helpers.js';
import type { PageImage } from './page-images.js';

export type NewTest = {
  code: string;
  subjectId: number;
  title: string;
  durationMinutes: number;
  allowedExits: AllowedExits;
  createdAt: number;
};

const SELECT_TEST_SUMMARY = `
  SELECT
    tests.id,
    tests.code,
    tests.title,
    tests.duration_minutes,
    tests.allowed_exits,
    tests.page_count,
    tests.created_at,
    subjects.id   AS subject_id,
    subjects.name AS subject_name
  FROM tests
  JOIN subjects ON subjects.id = tests.subject_id`;

export async function insertTestWithPages(
  database: Database,
  newTest: NewTest,
  pages: PageImage[],
): Promise<number> {
  const transaction = await database.transaction('write');
  try {
    const insertedTest = await transaction.execute({
      sql: `INSERT INTO tests
              (code, subject_id, title, duration_minutes, allowed_exits, page_count, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            RETURNING id`,
      args: [
        newTest.code,
        newTest.subjectId,
        newTest.title,
        newTest.durationMinutes,
        newTest.allowedExits,
        pages.length,
        newTest.createdAt,
      ],
    });
    const testId = Number(requireFirstRow(insertedTest).id);

    for (const [pageIndex, page] of pages.entries()) {
      await transaction.execute({
        sql: `INSERT INTO test_pages (test_id, page_no, image, width, height)
              VALUES (?, ?, ?, ?, ?)`,
        args: [testId, pageIndex + 1, page.data, page.width, page.height],
      });
    }

    await transaction.commit();
    return testId;
  } finally {
    transaction.close();
  }
}

export async function findTestById(
  database: Database,
  testId: number,
): Promise<TestSummary | undefined> {
  const { rows } = await database.execute({
    sql: `${SELECT_TEST_SUMMARY} WHERE tests.id = ?`,
    args: [testId],
  });
  const [row] = rows;
  return row ? toTestSummary(row) : undefined;
}

export async function isTestCodeTaken(database: Database, code: string): Promise<boolean> {
  const { rows } = await database.execute({
    sql: 'SELECT 1 FROM tests WHERE code = ?',
    args: [code],
  });
  return rows.length > 0;
}

function toTestSummary(row: Row): TestSummary {
  return {
    id: Number(row.id),
    code: String(row.code),
    title: String(row.title),
    subject: { id: Number(row.subject_id), name: String(row.subject_name) },
    durationMinutes: Number(row.duration_minutes),
    allowedExits: Number(row.allowed_exits) as AllowedExits,
    pageCount: Number(row.page_count),
    createdAt: Number(row.created_at),
  };
}
