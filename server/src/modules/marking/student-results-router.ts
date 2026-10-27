import type { StudentResultResponse } from '@exam-room/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import { forbidden, notFound } from '../../lib/http-errors.js';
import { parseInput } from '../../lib/parse-input.js';
import { findAttemptOfStudent, listAttemptsOfTest } from '../attempts/attempts-repository.js';
import { requireSessionStudent } from '../student-auth/student-session.js';
import { findStoredPaper } from '../tests/paper-repository.js';
import { findTestByCode } from '../tests/tests-repository.js';
import { readMarkingRows } from './marking-repository.js';
import { markAttempt } from './marking-service.js';
import { resultVisibility } from './result-visibility.js';
import { topScorerNames } from './score-attempt.js';
import { automaticMaxMarksOf, unitResultsOf } from './student-result.js';

const testCodeParamsSchema = z.object({
  testCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/),
});

export function createStudentResultsRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router();

  router.get('/:testCode', async (request, response) => {
    const student = await requireSessionStudent(dependencies, request);
    const { testCode } = parseInput(testCodeParamsSchema, request.params);
    const test = await findTestByCode(database, testCode);
    const attempt = test && (await findAttemptOfStudent(database, test.id, student.id));
    if (!test || !attempt) throw notFound('There is no result for this test.', 'result_not_found');
    const currentTime = clock.now();
    const visibility = resultVisibility(test, attempt, currentTime);
    if (visibility === 'hidden') {
      throw forbidden('Your teacher has not released the results yet.', 'results_not_released');
    }
    const isFinal = visibility === 'final';

    const [marking, storedPaper, rows, attempts] = await Promise.all([
      markAttempt(database, attempt, currentTime),
      findStoredPaper(database, test.id),
      readMarkingRows(database, test.id, attempt.id),
      isFinal ? listAttemptsOfTest(database, test.id) : Promise.resolve([]),
    ]);
    const { showCorrectAnswers, showComments, showTopScorer } = rows.releaseOptions;
    const { paper, answerKey } = storedPaper;
    const answers = new Map(marking.answers.map((answer) => [answer.questionId, answer]));
    const units = paper
      ? unitResultsOf(paper, answerKey, answers, marking.questionMarks, {
          isFinal,
          showCorrectAnswers,
          showComments,
        })
      : [];

    response.json({
      isFinal,
      testTitle: test.title,
      subjectName: test.subject.name,
      paper,
      maxMarks: isFinal || !paper ? (test.maxMarks ?? 0) : automaticMaxMarksOf(paper, answerKey),
      totalMarks: isFinal ? marking.score.totalMarks : marking.score.autoMarks,
      units,
      comment: isFinal && showComments ? marking.comment : '',
      topScorers: isFinal && showTopScorer ? topScorerNames(attempts) : null,
      releasedAt: test.resultsReleasedAt,
    } satisfies StudentResultResponse);
  });

  return router;
}
