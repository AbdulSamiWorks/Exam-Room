import type {
  AttemptResult,
  AttemptResultListResponse,
  AttemptResultResponse,
} from '@exam-room/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import type { Database } from '../../database/connection.js';
import { notFound } from '../../lib/http-errors.js';
import { parseInput } from '../../lib/parse-input.js';
import { requireTeacher } from '../auth/teacher-session.js';
import { findTestById } from '../tests/tests-repository.js';
import type { AttemptRecord } from './attempt-record.js';
import { summarizeAttempt } from './attempt-results.js';
import { unlockByTeacher } from './attempt-rules.js';
import { changeAttempt } from './attempt-service.js';
import { findAttemptById, listAttemptsOfTest, listExitsOfTest } from './attempts-repository.js';

const testIdParamsSchema = z.object({
  testId: z.coerce.number().int().positive(),
});

const attemptIdParamsSchema = z.object({
  attemptId: z.coerce.number().int().positive(),
});

export function createTestResultsRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router({ mergeParams: true });

  router.use(requireTeacher(dependencies));

  router.get('/', async (request, response) => {
    const { testId } = parseInput(testIdParamsSchema, request.params);
    if (!(await findTestById(database, testId))) throw notFound('Test not found.');

    const currentTime = clock.now();
    const attempts = await listAttemptsOfTest(database, testId);
    const exitsByAttemptId = await listExitsOfTest(database, testId);

    response.json({
      attempts: attempts.map((attempt) =>
        summarizeAttempt(attempt, exitsByAttemptId.get(attempt.id) ?? [], currentTime),
      ),
      serverTime: currentTime,
    } satisfies AttemptResultListResponse);
  });

  return router;
}

export function createTeacherAttemptsRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router();

  router.use(requireTeacher(dependencies));

  router.post('/:attemptId/unlock', async (request, response) => {
    const { attemptId } = parseInput(attemptIdParamsSchema, request.params);
    const attempt = await findAttemptById(database, attemptId);
    if (!attempt) throw notFound('Student attempt not found.');

    const unlockedAttempt = await changeAttempt(database, attempt, (current) =>
      unlockByTeacher(current, clock.now()),
    );
    response.json({
      attempt: await buildAttemptResult(database, unlockedAttempt, clock.now()),
    } satisfies AttemptResultResponse);
  });

  return router;
}

async function buildAttemptResult(
  database: Database,
  attempt: AttemptRecord,
  currentTime: number,
): Promise<AttemptResult> {
  const exitsByAttemptId = await listExitsOfTest(database, attempt.testId);
  return summarizeAttempt(attempt, exitsByAttemptId.get(attempt.id) ?? [], currentTime);
}
