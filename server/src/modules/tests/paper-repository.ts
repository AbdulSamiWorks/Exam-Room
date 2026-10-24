import type { AnswerKey, Paper, TeacherPaperResponse } from '@exam-room/shared';
import { maxMarksOf, questionsOf } from '@exam-room/shared/paper-rules';
import type { InStatement } from '@libsql/client';
import type { Database } from '../../database/connection.js';
import type { PageImage } from './page-images.js';
import { startedAttemptExists } from './started-attempts.js';

export type StoredPaper = {
  paper: Paper;
  answerKey: AnswerKey;
};

export type PaperColumnValues = {
  paper: string | null;
  answerKey: string;
  questionCount: number;
  maxMarks: number | null;
};

const EMPTY_ANSWER_KEY = '{}';

export function paperColumnValues(storedPaper: StoredPaper | undefined): PaperColumnValues {
  if (!storedPaper) {
    return { paper: null, answerKey: EMPTY_ANSWER_KEY, questionCount: 0, maxMarks: null };
  }
  return {
    paper: JSON.stringify(storedPaper.paper),
    answerKey: JSON.stringify(storedPaper.answerKey),
    questionCount: questionsOf(storedPaper.paper).length,
    maxMarks: maxMarksOf(storedPaper.paper),
  };
}

export function insertPaperImageStatements(
  testId: number,
  images: readonly PageImage[],
): InStatement[] {
  return images.map((image, imageIndex) => ({
    sql: `INSERT INTO paper_images (test_id, image_no, image, width, height)
          VALUES (?, ?, ?, ?, ?)`,
    args: [testId, imageIndex + 1, image.data, image.width, image.height],
  }));
}

export async function findStoredPaper(
  database: Database,
  testId: number,
): Promise<TeacherPaperResponse> {
  const { rows } = await database.execute({
    sql: `SELECT paper, answer_key,
                 (SELECT COUNT(*) FROM paper_images WHERE test_id = tests.id) AS image_count
          FROM tests WHERE id = ?`,
    args: [testId],
  });
  const [row] = rows;
  return {
    paper: row?.paper ? (JSON.parse(String(row.paper)) as Paper) : null,
    answerKey: row ? (JSON.parse(String(row.answer_key)) as AnswerKey) : {},
    imageCount: Number(row?.image_count ?? 0),
  };
}

export async function findPaperForStudents(
  database: Database,
  testId: number,
): Promise<Paper | undefined> {
  const { rows } = await database.execute({
    sql: 'SELECT paper FROM tests WHERE id = ?',
    args: [testId],
  });
  const paperJson = rows[0]?.paper;
  return paperJson ? (JSON.parse(String(paperJson)) as Paper) : undefined;
}

export async function replacePaperBeforeAnyStart(
  database: Database,
  testId: number,
  storedPaper: StoredPaper,
  images: readonly PageImage[],
): Promise<boolean> {
  const columns = paperColumnValues(storedPaper);
  const transaction = await database.transaction('write');
  try {
    if (await startedAttemptExists(transaction, testId)) return false;
    await transaction.batch([
      {
        sql: `UPDATE tests SET paper = ?, answer_key = ?, question_count = ?, max_marks = ?
              WHERE id = ?`,
        args: [columns.paper, columns.answerKey, columns.questionCount, columns.maxMarks, testId],
      },
      { sql: 'DELETE FROM paper_images WHERE test_id = ?', args: [testId] },
      ...insertPaperImageStatements(testId, images),
    ]);
    await transaction.commit();
    return true;
  } finally {
    transaction.close();
  }
}

export async function saveAnswerKey(
  database: Database,
  testId: number,
  answerKey: AnswerKey,
): Promise<void> {
  await database.execute({
    sql: 'UPDATE tests SET answer_key = ? WHERE id = ?',
    args: [JSON.stringify(answerKey), testId],
  });
}

export async function findPaperImage(
  database: Database,
  testId: number,
  imageNumber: number,
): Promise<Buffer | undefined> {
  const { rows } = await database.execute({
    sql: 'SELECT image FROM paper_images WHERE test_id = ? AND image_no = ?',
    args: [testId, imageNumber],
  });
  const [row] = rows;
  return row ? Buffer.from(row.image as ArrayBuffer) : undefined;
}
