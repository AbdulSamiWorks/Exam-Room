import type { AttemptScore, QuestionMark, ReleaseOptions, StoredAnswer } from '@exam-room/shared';
import type { Row } from '@libsql/client';
import type { Database } from '../../database/connection.js';

export type MarkingRows = {
  answersByAttemptId: Map<number, Map<string, StoredAnswer>>;
  marksByAttemptId: Map<number, Map<string, QuestionMark>>;
  commentsByAttemptId: Map<number, string>;
  photoCountsByAttemptId: Map<number, number>;
  releaseOptions: ReleaseOptions;
};

export type AttemptScoreUpdate = {
  attemptId: number;
  score: AttemptScore;
};

export async function readMarkingRows(
  database: Database,
  testId: number,
  attemptId?: number,
): Promise<MarkingRows> {
  const attemptFilter = attemptId === undefined ? '' : 'AND attempts.id = ?';
  const args = attemptId === undefined ? [testId] : [testId, attemptId];
  const [answerRows, markRows, attemptRows, photoRows, releaseRows] = await database.batch(
    [
      {
        sql: `SELECT answers.attempt_id, answers.question_id, answers.choice, answers.text,
                     answers.sequence
              FROM answers JOIN attempts ON attempts.id = answers.attempt_id
              WHERE attempts.test_id = ? ${attemptFilter}`,
        args,
      },
      {
        sql: `SELECT question_marks.attempt_id, question_marks.question_id, question_marks.marks,
                     question_marks.comment
              FROM question_marks JOIN attempts ON attempts.id = question_marks.attempt_id
              WHERE attempts.test_id = ? ${attemptFilter}`,
        args,
      },
      {
        sql: `SELECT attempts.id, attempts.teacher_comment FROM attempts
              WHERE attempts.test_id = ? ${attemptFilter}`,
        args,
      },
      {
        sql: `SELECT answer_photos.attempt_id, COUNT(*) AS photo_count
              FROM answer_photos JOIN attempts ON attempts.id = answer_photos.attempt_id
              WHERE attempts.test_id = ? ${attemptFilter}
              GROUP BY answer_photos.attempt_id`,
        args,
      },
      {
        sql: `SELECT show_correct_answers, show_comments, show_top_scorer FROM tests WHERE id = ?`,
        args: [testId],
      },
    ],
    'read',
  );

  const release = releaseRows?.rows[0];
  return {
    answersByAttemptId: groupByAttempt(answerRows?.rows ?? [], (row) => ({
      questionId: String(row.question_id),
      choice: row.choice === null ? null : Number(row.choice),
      text: row.text === null ? null : String(row.text),
      sequence: Number(row.sequence),
    })),
    marksByAttemptId: groupByAttempt(markRows?.rows ?? [], (row) => ({
      questionId: String(row.question_id),
      marks: row.marks === null ? null : Number(row.marks),
      comment: String(row.comment),
    })),
    commentsByAttemptId: new Map(
      (attemptRows?.rows ?? []).map((row) => [Number(row.id), String(row.teacher_comment)]),
    ),
    photoCountsByAttemptId: new Map(
      (photoRows?.rows ?? []).map((row) => [Number(row.attempt_id), Number(row.photo_count)]),
    ),
    releaseOptions: {
      showCorrectAnswers: Number(release?.show_correct_answers ?? 1) === 1,
      showComments: Number(release?.show_comments ?? 1) === 1,
      showTopScorer: Number(release?.show_top_scorer ?? 1) === 1,
    },
  };
}

function groupByAttempt<Value extends { questionId: string }>(
  rows: readonly Row[],
  toValue: (row: Row) => Value,
): Map<number, Map<string, Value>> {
  const grouped = new Map<number, Map<string, Value>>();
  for (const row of rows) {
    const attemptId = Number(row.attempt_id);
    const values = grouped.get(attemptId) ?? new Map<string, Value>();
    const value = toValue(row);
    values.set(value.questionId, value);
    grouped.set(attemptId, values);
  }
  return grouped;
}

export async function saveScores(
  database: Database,
  updates: readonly AttemptScoreUpdate[],
): Promise<void> {
  if (updates.length === 0) return;
  await database.batch(
    updates.map(({ attemptId, score }) => ({
      sql: `UPDATE attempts SET mcq_marks = ?, written_marks = ?, total_marks = ?
            WHERE id = ? AND (total_marks IS NULL OR total_marks <> ? OR mcq_marks <> ?
                              OR written_marks <> ?)`,
      args: [
        score.mcqMarks,
        score.writtenMarks,
        score.totalMarks,
        attemptId,
        score.totalMarks,
        score.mcqMarks,
        score.writtenMarks,
      ],
    })),
    'write',
  );
}

export async function replaceQuestionMarks(
  database: Database,
  attemptId: number,
  questionMarks: Readonly<Record<string, QuestionMark>>,
  comment: string,
): Promise<void> {
  await database.batch(
    [
      { sql: 'DELETE FROM question_marks WHERE attempt_id = ?', args: [attemptId] },
      ...Object.entries(questionMarks)
        .filter(([, mark]) => mark.marks !== null || mark.comment)
        .map(([questionId, mark]) => ({
          sql: `INSERT INTO question_marks (attempt_id, question_id, marks, comment)
                VALUES (?, ?, ?, ?)`,
          args: [attemptId, questionId, mark.marks, mark.comment],
        })),
      { sql: 'UPDATE attempts SET teacher_comment = ? WHERE id = ?', args: [comment, attemptId] },
    ],
    'write',
  );
}

export async function saveRelease(
  database: Database,
  testId: number,
  releasedAt: number | null,
  options: ReleaseOptions,
): Promise<void> {
  await database.execute({
    sql: `UPDATE tests
          SET results_released_at = ?, show_correct_answers = ?, show_comments = ?,
              show_top_scorer = ?
          WHERE id = ?`,
    args: [
      releasedAt,
      Number(options.showCorrectAnswers),
      Number(options.showComments),
      Number(options.showTopScorer),
      testId,
    ],
  });
}
