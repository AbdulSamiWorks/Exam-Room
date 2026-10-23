import type {
  AllowedExits,
  LeaveRule,
  PageSize,
  TestSchedule,
  TestSettings,
} from '@exam-room/shared';
import type { Row, Transaction } from '@libsql/client';
import type { Database } from '../../database/connection.js';
import { requireFirstRow } from '../../database/query-helpers.js';
import type { PageImage } from './page-images.js';
import type { TestRecord } from './test-record.js';

export type NewTest = {
  code: string;
  subjectId: number;
  title: string;
  durationMinutes: number;
  allowedExits: AllowedExits;
  leaveRule: LeaveRule;
  createdAt: number;
};

const SELECT_TEST_SUMMARY = `
  SELECT
    tests.id,
    tests.code,
    tests.title,
    tests.duration_minutes,
    tests.allowed_exits,
    tests.leave_rule,
    tests.page_count,
    tests.created_at,
    tests.opens_at,
    tests.closes_at,
    subjects.id   AS subject_id,
    subjects.name AS subject_name,
    (SELECT COUNT(*) FROM attempts WHERE attempts.test_id = tests.id) AS student_count
  FROM tests
  JOIN subjects ON subjects.id = tests.subject_id`;

export type TestListFilter = {
  subjectId?: number;
};

export async function listTests(
  database: Database,
  filter: TestListFilter = {},
): Promise<TestRecord[]> {
  const { rows } = await database.execute(
    filter.subjectId === undefined
      ? `${SELECT_TEST_SUMMARY} ORDER BY subjects.name, tests.created_at DESC`
      : {
          sql: `${SELECT_TEST_SUMMARY} WHERE tests.subject_id = ? ORDER BY tests.created_at DESC`,
          args: [filter.subjectId],
        },
  );
  return rows.map(toTestRecord);
}

export async function insertTestWithPages(
  database: Database,
  newTest: NewTest,
  pages: PageImage[],
): Promise<number> {
  const transaction = await database.transaction('write');
  try {
    const insertedTest = await transaction.execute({
      sql: `INSERT INTO tests
              (code, subject_id, title, duration_minutes, allowed_exits, leave_rule, page_count,
               created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id`,
      args: [
        newTest.code,
        newTest.subjectId,
        newTest.title,
        newTest.durationMinutes,
        newTest.allowedExits,
        newTest.leaveRule,
        pages.length,
        newTest.createdAt,
      ],
    });
    const testId = Number(requireFirstRow(insertedTest).id);
    await insertPages(transaction, testId, pages);
    await transaction.commit();
    return testId;
  } finally {
    transaction.close();
  }
}

export async function replacePagesBeforeAnyStart(
  database: Database,
  testId: number,
  pages: PageImage[],
): Promise<boolean> {
  const transaction = await database.transaction('write');
  try {
    const startedAttempts = await transaction.execute({
      sql: 'SELECT 1 FROM attempts WHERE test_id = ? LIMIT 1',
      args: [testId],
    });
    if (startedAttempts.rows.length > 0) return false;

    await transaction.execute({ sql: 'DELETE FROM test_pages WHERE test_id = ?', args: [testId] });
    await insertPages(transaction, testId, pages);
    await transaction.execute({
      sql: 'UPDATE tests SET page_count = ? WHERE id = ?',
      args: [pages.length, testId],
    });
    await transaction.commit();
    return true;
  } finally {
    transaction.close();
  }
}

async function insertPages(
  transaction: Transaction,
  testId: number,
  pages: PageImage[],
): Promise<void> {
  for (const [pageIndex, page] of pages.entries()) {
    await transaction.execute({
      sql: `INSERT INTO test_pages (test_id, page_no, image, width, height)
            VALUES (?, ?, ?, ?, ?)`,
      args: [testId, pageIndex + 1, page.data, page.width, page.height],
    });
  }
}

export async function saveTestSettings(
  database: Database,
  testId: number,
  settings: TestSettings,
): Promise<void> {
  await database.execute({
    sql: `UPDATE tests
          SET subject_id = ?, title = ?, duration_minutes = ?, allowed_exits = ?, leave_rule = ?
          WHERE id = ?`,
    args: [
      settings.subjectId,
      settings.title,
      settings.durationMinutes,
      settings.allowedExits,
      settings.leaveRule,
      testId,
    ],
  });
}

export async function findTestById(
  database: Database,
  testId: number,
): Promise<TestRecord | undefined> {
  const { rows } = await database.execute({
    sql: `${SELECT_TEST_SUMMARY} WHERE tests.id = ?`,
    args: [testId],
  });
  const [row] = rows;
  return row ? toTestRecord(row) : undefined;
}

export async function findTestByCode(
  database: Database,
  code: string,
): Promise<TestRecord | undefined> {
  const { rows } = await database.execute({
    sql: `${SELECT_TEST_SUMMARY} WHERE tests.code = ?`,
    args: [code],
  });
  const [row] = rows;
  return row ? toTestRecord(row) : undefined;
}

export async function listPageSizes(database: Database, testId: number): Promise<PageSize[]> {
  const { rows } = await database.execute({
    sql: 'SELECT width, height FROM test_pages WHERE test_id = ? ORDER BY page_no',
    args: [testId],
  });
  return rows.map((row) => ({ width: Number(row.width), height: Number(row.height) }));
}

export async function findPageImage(
  database: Database,
  testId: number,
  pageNumber: number,
): Promise<Buffer | undefined> {
  const { rows } = await database.execute({
    sql: 'SELECT image FROM test_pages WHERE test_id = ? AND page_no = ?',
    args: [testId, pageNumber],
  });
  const [row] = rows;
  return row ? Buffer.from(row.image as ArrayBuffer) : undefined;
}

export async function saveTestSchedule(
  database: Database,
  testId: number,
  schedule: TestSchedule,
): Promise<void> {
  await database.execute({
    sql: 'UPDATE tests SET opens_at = ?, closes_at = ? WHERE id = ?',
    args: [schedule.opensAt, schedule.closesAt, testId],
  });
}

export async function deleteTestWithResults(database: Database, testId: number): Promise<void> {
  await database.batch(
    [
      {
        sql: 'DELETE FROM exits WHERE attempt_id IN (SELECT id FROM attempts WHERE test_id = ?)',
        args: [testId],
      },
      { sql: 'DELETE FROM attempts WHERE test_id = ?', args: [testId] },
      { sql: 'DELETE FROM test_pages WHERE test_id = ?', args: [testId] },
      { sql: 'DELETE FROM tests WHERE id = ?', args: [testId] },
    ],
    'write',
  );
}

export async function isTestCodeTaken(database: Database, code: string): Promise<boolean> {
  const { rows } = await database.execute({
    sql: 'SELECT 1 FROM tests WHERE code = ?',
    args: [code],
  });
  return rows.length > 0;
}

function toTestRecord(row: Row): TestRecord {
  return {
    id: Number(row.id),
    code: String(row.code),
    title: String(row.title),
    subject: { id: Number(row.subject_id), name: String(row.subject_name) },
    durationMinutes: Number(row.duration_minutes),
    allowedExits: Number(row.allowed_exits) as AllowedExits,
    leaveRule: String(row.leave_rule) as LeaveRule,
    pageCount: Number(row.page_count),
    studentCount: Number(row.student_count),
    createdAt: Number(row.created_at),
    opensAt: row.opens_at === null ? null : Number(row.opens_at),
    closesAt: row.closes_at === null ? null : Number(row.closes_at),
  };
}
