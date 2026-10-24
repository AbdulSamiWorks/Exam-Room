import type {
  AttemptMarking,
  AttemptScore,
  MarkingResponse,
  TeacherPaperResponse,
} from '@exam-room/shared';
import type { Database } from '../../database/connection.js';
import type { AttemptRecord } from '../attempts/attempt-record.js';
import { applyTimeLimit } from '../attempts/attempt-rules.js';
import { listAttemptsOfTest } from '../attempts/attempts-repository.js';
import { findStoredPaper } from '../tests/paper-repository.js';
import type { TestRecord } from '../tests/test-record.js';
import { readMarkingRows, saveScores, type MarkingRows } from './marking-repository.js';
import { scoreAttempt } from './score-attempt.js';

export async function markTest(
  database: Database,
  test: TestRecord,
  currentTime: number,
): Promise<MarkingResponse> {
  const [storedPaper, attempts, rows] = await Promise.all([
    findStoredPaper(database, test.id),
    listAttemptsOfTest(database, test.id),
    readMarkingRows(database, test.id),
  ]);
  const markings = attempts.map((attempt) =>
    buildAttemptMarking(attempt, storedPaper, rows, currentTime),
  );
  if (storedPaper.paper) {
    await saveScores(
      database,
      markings.map((marking) => ({ attemptId: marking.attemptId, score: marking.score })),
    );
  }

  return {
    paper: storedPaper.paper,
    answerKey: storedPaper.answerKey,
    maxMarks: test.maxMarks ?? 0,
    attempts: markings,
    releasedAt: test.resultsReleasedAt,
    releaseOptions: rows.releaseOptions,
  };
}

export async function markAttempt(
  database: Database,
  attempt: AttemptRecord,
  currentTime: number,
): Promise<AttemptMarking> {
  const [storedPaper, rows] = await Promise.all([
    findStoredPaper(database, attempt.testId),
    readMarkingRows(database, attempt.testId, attempt.id),
  ]);
  const marking = buildAttemptMarking(attempt, storedPaper, rows, currentTime);
  if (storedPaper.paper) {
    await saveScores(database, [{ attemptId: attempt.id, score: marking.score }]);
  }
  return marking;
}

function buildAttemptMarking(
  storedAttempt: AttemptRecord,
  { paper, answerKey }: TeacherPaperResponse,
  rows: MarkingRows,
  currentTime: number,
): AttemptMarking {
  const attempt = applyTimeLimit(storedAttempt, currentTime).attempt;
  const answers = rows.answersByAttemptId.get(attempt.id) ?? new Map();
  const questionMarks = rows.marksByAttemptId.get(attempt.id) ?? new Map();
  return {
    attemptId: attempt.id,
    studentName: attempt.studentName,
    rollNumber: attempt.rollNumber,
    status: attempt.status,
    finishReason: attempt.finishReason,
    answers: [...answers.values()],
    questionMarks: Object.fromEntries(
      [...questionMarks].map(([questionId, mark]) => [
        questionId,
        { marks: mark.marks, comment: mark.comment },
      ]),
    ),
    comment: rows.commentsByAttemptId.get(attempt.id) ?? '',
    photoCount: rows.photoCountsByAttemptId.get(attempt.id) ?? 0,
    score: paper
      ? scoreAttempt(paper, answerKey, answers, questionMarks)
      : enteredScore(attempt.totalMarks),
  };
}

function enteredScore(totalMarks: number | null): AttemptScore {
  return {
    mcqMarks: 0,
    writtenMarks: totalMarks ?? 0,
    totalMarks: totalMarks ?? 0,
    correctCount: 0,
    mcqCount: 0,
    markedWrittenCount: totalMarks === null ? 0 : 1,
    writtenCount: 1,
  };
}
