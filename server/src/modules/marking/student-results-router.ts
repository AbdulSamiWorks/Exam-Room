import type { QuestionResult, StudentResultResponse } from '@exam-room/shared';
import { questionsOf } from '@exam-room/shared/paper-rules';
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
import { topScorerNames } from './score-attempt.js';

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
    if (test.resultsReleasedAt === null) {
      throw forbidden('Your teacher has not released the results yet.', 'results_not_released');
    }

    const [marking, storedPaper, rows, attempts] = await Promise.all([
      markAttempt(database, attempt, clock.now()),
      findStoredPaper(database, test.id),
      readMarkingRows(database, test.id, attempt.id),
      listAttemptsOfTest(database, test.id),
    ]);
    const { showCorrectAnswers, showComments, showTopScorer } = rows.releaseOptions;
    const answers = new Map(marking.answers.map((answer) => [answer.questionId, answer]));
    const questions: QuestionResult[] = storedPaper.paper
      ? questionsOf(storedPaper.paper).map((question) => {
          const mark = marking.questionMarks[question.id];
          const answer = answers.get(question.id);
          const correctOption = storedPaper.answerKey[question.id]?.option;
          const isCorrect = correctOption !== undefined && answer?.choice === correctOption;
          return {
            questionId: question.id,
            marks:
              mark?.marks ?? (question.kind === 'mcq' ? (isCorrect ? question.marks : 0) : null),
            chosenOption: answer?.choice ?? null,
            typedAnswer: answer?.text ?? null,
            correctOption: showCorrectAnswers ? (correctOption ?? null) : null,
            comment: showComments ? (mark?.comment ?? '') : '',
          };
        })
      : [];

    response.json({
      testTitle: test.title,
      subjectName: test.subject.name,
      paper: storedPaper.paper,
      maxMarks: test.maxMarks ?? 0,
      totalMarks: marking.score.totalMarks,
      questions,
      comment: showComments ? marking.comment : '',
      topScorers: showTopScorer ? topScorerNames(attempts) : null,
      releasedAt: test.resultsReleasedAt,
    } satisfies StudentResultResponse);
  });

  return router;
}
