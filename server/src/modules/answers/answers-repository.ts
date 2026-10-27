import type { AnswerChange, StoredAnswer } from '@exam-room/shared';
import type { Database } from '../../database/connection.js';

export async function saveAnswers(
  database: Database,
  attemptId: number,
  changes: readonly AnswerChange[],
  receivedAt: number,
): Promise<void> {
  if (changes.length === 0) return;
  await database.batch(
    changes.map((change) => ({
      sql: `INSERT INTO answers
              (attempt_id, question_id, choice, text, sequence, answered_at, received_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (attempt_id, question_id) DO UPDATE SET
              choice = excluded.choice,
              text = excluded.text,
              sequence = excluded.sequence,
              answered_at = excluded.answered_at,
              received_at = excluded.received_at
            WHERE excluded.sequence > answers.sequence`,
      args: [
        attemptId,
        change.questionId,
        change.choice,
        change.text,
        change.sequence,
        Math.min(change.answeredAt, receivedAt),
        receivedAt,
      ],
    })),
    'write',
  );
}

export async function listAnswersOfAttempt(
  database: Database,
  attemptId: number,
): Promise<StoredAnswer[]> {
  const { rows } = await database.execute({
    sql: `SELECT question_id, choice, text, sequence FROM answers
          WHERE attempt_id = ? ORDER BY question_id`,
    args: [attemptId],
  });
  return rows.map((row) => ({
    questionId: String(row.question_id),
    choice: row.choice === null ? null : Number(row.choice),
    text: row.text === null ? null : String(row.text),
    sequence: Number(row.sequence),
  }));
}

export async function countAnswersOfTest(
  database: Database,
  testId: number,
): Promise<Map<number, number>> {
  const { rows } = await database.execute({
    sql: `SELECT answers.attempt_id,
                 COUNT(DISTINCT CASE WHEN instr(answers.question_id, '.') > 0
                   THEN substr(answers.question_id, 1, instr(answers.question_id, '.') - 1)
                   ELSE answers.question_id END) AS answered_count
          FROM answers
          JOIN attempts ON attempts.id = answers.attempt_id
          WHERE attempts.test_id = ? AND (answers.choice IS NOT NULL OR answers.text <> '')
          GROUP BY answers.attempt_id`,
    args: [testId],
  });
  return new Map(rows.map((row) => [Number(row.attempt_id), Number(row.answered_count)]));
}
