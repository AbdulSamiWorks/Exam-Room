import type {
  AttemptMarkingResponse,
  MarkingResponse,
  ReleaseResultsResponse,
} from '@exam-room/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import { badRequest, notFound } from '../../lib/http-errors.js';
import { idParams } from '../../lib/input-fields.js';
import { parseInput } from '../../lib/parse-input.js';
import { requireTeacher } from '../auth/teacher-session.js';
import { findAttemptById } from '../attempts/attempts-repository.js';
import { findPaperForStudents } from '../tests/paper-repository.js';
import type { TestRecord } from '../tests/test-record.js';
import { findTestById } from '../tests/tests-repository.js';
import { replaceQuestionMarks, saveRelease } from './marking-repository.js';
import { markAttempt, markTest } from './marking-service.js';
import { marksProblem } from './score-attempt.js';

const MAX_COMMENT_LENGTH = 2000;

const saveMarksSchema = z.object({
  questionMarks: z.record(
    z.string().regex(/^q\d{1,4}$/),
    z.object({
      marks: z.number().min(0).multipleOf(0.5, 'Marks can be whole or half marks.').nullable(),
      comment: z.string().trim().max(MAX_COMMENT_LENGTH),
    }),
  ),
  comment: z.string().trim().max(MAX_COMMENT_LENGTH),
});

const releaseSchema = z.object({
  showCorrectAnswers: z.boolean(),
  showComments: z.boolean(),
  showTopScorer: z.boolean(),
});

const testIdParamsSchema = idParams('testId');
const attemptIdParamsSchema = idParams('attemptId');

export function createTestMarkingRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router({ mergeParams: true });

  router.use(requireTeacher(dependencies));

  async function requireTest(request: Request): Promise<TestRecord> {
    const { testId } = parseInput(testIdParamsSchema, request.params);
    const test = await findTestById(database, testId);
    if (!test) throw notFound('Test not found.');
    return test;
  }

  router.get('/marking', async (request, response) => {
    const test = await requireTest(request);
    response.json((await markTest(database, test, clock.now())) satisfies MarkingResponse);
  });

  router.put('/release', async (request, response) => {
    const test = await requireTest(request);
    const releaseOptions = parseInput(releaseSchema, request.body);
    await markTest(database, test, clock.now());
    const releasedAt = test.resultsReleasedAt ?? clock.now();
    await saveRelease(database, test.id, releasedAt, releaseOptions);
    response.json({ releasedAt, releaseOptions } satisfies ReleaseResultsResponse);
  });

  router.delete('/release', async (request, response) => {
    const test = await requireTest(request);
    const marking = await markTest(database, test, clock.now());
    await saveRelease(database, test.id, null, marking.releaseOptions);
    response.json({
      releasedAt: null,
      releaseOptions: marking.releaseOptions,
    } satisfies ReleaseResultsResponse);
  });

  return router;
}

export function createAttemptMarksRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router({ mergeParams: true });

  router.use(requireTeacher(dependencies));

  router.put('/', async (request, response) => {
    const { attemptId } = parseInput(attemptIdParamsSchema, request.params);
    const attempt = await findAttemptById(database, attemptId);
    if (!attempt) throw notFound('Student attempt not found.');
    const { questionMarks, comment } = parseInput(saveMarksSchema, request.body);
    const paper = await findPaperForStudents(database, attempt.testId);
    if (!paper) throw badRequest('This test has no questions to mark.', 'paper_required');
    const problem = marksProblem(paper, questionMarks);
    if (problem) throw badRequest(problem, 'invalid_marks');

    await replaceQuestionMarks(database, attempt.id, questionMarks, comment);
    response.json({
      attempt: await markAttempt(database, attempt, clock.now()),
    } satisfies AttemptMarkingResponse);
  });

  return router;
}
