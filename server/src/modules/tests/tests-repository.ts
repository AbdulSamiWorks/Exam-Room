import type {
  AllowedExits,
  LeaveRule,
  PageSize,
  PaperKind,
  TestKind,
  TestSchedule,
  WrittenAnswers,
} from '@exam-room/shared';
import type { Row, Transaction } from '@libsql/client';
import type { Database } from '../../database/connection.js';
import { requireFirstRow } from '../../database/query-helpers.js';
import type { PageImage } from './page-images.js';
import { startedAttemptExists } from './started-attempts.js';
import {
  insertPaperImageStatements,
  paperColumnValues,
  type StoredPaper,
} from './paper-repository.js';
import {
  chapterTagsByTestId,
  chapterTagsQuery,
  insertChapterTagsStatements,
  replaceChapterTagsStatements,
} from './test-chapters-repository.js';
import type { TestRecord, TestWithChapters } from './test-record.js';
import type { StoredTestSettings } from './test-settings.js';

export type NewTest = StoredTestSettings & {
  code: string;
  chapterIds: number[];
  createdAt: number;
};

export type TestContent =
  | { paperKind: 'pages'; pages: PageImage[]; answerSheet: StoredPaper | undefined }
  | { paperKind: 'typed'; typedPaper: StoredPaper; paperImages: PageImage[] };

const SELECT_TEST_SUMMARY = `
  SELECT
    tests.id,
    tests.code,
    tests.kind,
    tests.title,
    tests.duration_minutes,
    tests.allowed_exits,
    tests.leave_rule,
    tests.paper_kind,
    tests.page_count,
    tests.question_count,
    tests.max_marks,
    tests.written_answers,
    tests.created_at,
    tests.opens_at,
    tests.closes_at,
    subjects.id   AS subject_id,
    subjects.name AS subject_name,
    classes.id    AS class_id,
    classes.name  AS class_name,
    (SELECT COUNT(*) FROM attempts WHERE attempts.test_id = tests.id) AS student_count
  FROM tests
  JOIN subjects ON subjects.id = tests.subject_id
  JOIN classes ON classes.id = subjects.class_id`;

const NEWEST_FIRST = 'ORDER BY tests.created_at DESC, tests.id DESC';

export type TestListFilter = {
  subjectId?: number;
};

export async function listTests(
  database: Database,
  filter: TestListFilter = {},
): Promise<TestWithChapters[]> {
  const { subjectId } = filter;
  const [testRows, tagRows] = await database.batch(
    subjectId === undefined
      ? [`${SELECT_TEST_SUMMARY} ${NEWEST_FIRST}`, chapterTagsQuery('all tests')]
      : [
          {
            sql: `${SELECT_TEST_SUMMARY} WHERE tests.subject_id = ? ${NEWEST_FIRST}`,
            args: [subjectId],
          },
          chapterTagsQuery({ subjectId }),
        ],
    'read',
  );
  return withChapters(testRows?.rows ?? [], tagRows?.rows ?? []);
}

export async function findTestWithChapters(
  database: Database,
  testId: number,
): Promise<TestWithChapters | undefined> {
  const [testRows, tagRows] = await database.batch(
    [
      { sql: `${SELECT_TEST_SUMMARY} WHERE tests.id = ?`, args: [testId] },
      chapterTagsQuery({ testId }),
    ],
    'read',
  );
  const [test] = withChapters(testRows?.rows ?? [], tagRows?.rows ?? []);
  return test;
}

export async function insertTest(
  database: Database,
  newTest: NewTest,
  content: TestContent,
): Promise<number> {
  const pages = content.paperKind === 'pages' ? content.pages : [];
  const storedPaper = content.paperKind === 'pages' ? content.answerSheet : content.typedPaper;
  const paperColumns = paperColumnValues(storedPaper);

  const transaction = await database.transaction('write');
  try {
    const insertedTest = await transaction.execute({
      sql: `INSERT INTO tests
              (code, subject_id, kind, title, duration_minutes, allowed_exits, leave_rule,
               written_answers, paper_kind, page_count, paper, answer_key, question_count,
               max_marks, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id`,
      args: [
        newTest.code,
        newTest.subjectId,
        newTest.kind,
        newTest.title,
        newTest.durationMinutes,
        newTest.allowedExits,
        newTest.leaveRule,
        newTest.writtenAnswers,
        content.paperKind,
        pages.length,
        paperColumns.paper,
        paperColumns.answerKey,
        paperColumns.questionCount,
        paperColumns.maxMarks,
        newTest.createdAt,
      ],
    });
    const testId = Number(requireFirstRow(insertedTest).id);
    await insertPages(transaction, testId, pages);
    const followingStatements = [
      ...insertChapterTagsStatements(testId, newTest.chapterIds),
      ...(content.paperKind === 'typed'
        ? insertPaperImageStatements(testId, content.paperImages)
        : []),
    ];
    if (followingStatements.length > 0) await transaction.batch(followingStatements);
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
    if (await startedAttemptExists(transaction, testId)) return false;

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
  settings: StoredTestSettings,
  chapterIds: readonly number[] | undefined,
): Promise<void> {
  await database.batch(
    [
      {
        sql: `UPDATE tests
              SET subject_id = ?, kind = ?, title = ?, duration_minutes = ?, allowed_exits = ?,
                  leave_rule = ?, written_answers = ?
              WHERE id = ?`,
        args: [
          settings.subjectId,
          settings.kind,
          settings.title,
          settings.durationMinutes,
          settings.allowedExits,
          settings.leaveRule,
          settings.writtenAnswers,
          testId,
        ],
      },
      ...(chapterIds === undefined ? [] : replaceChapterTagsStatements(testId, chapterIds)),
    ],
    'write',
  );
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
      {
        sql: 'DELETE FROM answers WHERE attempt_id IN (SELECT id FROM attempts WHERE test_id = ?)',
        args: [testId],
      },
      {
        sql: `DELETE FROM answer_photos
              WHERE attempt_id IN (SELECT id FROM attempts WHERE test_id = ?)`,
        args: [testId],
      },
      { sql: 'DELETE FROM attempts WHERE test_id = ?', args: [testId] },
      { sql: 'DELETE FROM test_pages WHERE test_id = ?', args: [testId] },
      { sql: 'DELETE FROM paper_images WHERE test_id = ?', args: [testId] },
      { sql: 'DELETE FROM test_chapters WHERE test_id = ?', args: [testId] },
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

function withChapters(testRows: readonly Row[], tagRows: readonly Row[]): TestWithChapters[] {
  const tagsByTestId = chapterTagsByTestId(tagRows);
  return testRows.map((row) => {
    const test = toTestRecord(row);
    return { ...test, chapters: tagsByTestId.get(test.id) ?? [] };
  });
}

function toTestRecord(row: Row): TestRecord {
  const classId = Number(row.class_id);
  return {
    id: Number(row.id),
    code: String(row.code),
    kind: String(row.kind) as TestKind,
    title: String(row.title),
    schoolClass: { id: classId, name: String(row.class_name) },
    subject: { id: Number(row.subject_id), classId, name: String(row.subject_name) },
    durationMinutes: Number(row.duration_minutes),
    allowedExits: Number(row.allowed_exits) as AllowedExits,
    leaveRule: String(row.leave_rule) as LeaveRule,
    paperKind: String(row.paper_kind) as PaperKind,
    pageCount: Number(row.page_count),
    questionCount: Number(row.question_count),
    maxMarks: row.max_marks === null ? null : Number(row.max_marks),
    writtenAnswers: String(row.written_answers) as WrittenAnswers,
    studentCount: Number(row.student_count),
    createdAt: Number(row.created_at),
    opensAt: row.opens_at === null ? null : Number(row.opens_at),
    closesAt: row.closes_at === null ? null : Number(row.closes_at),
  };
}
