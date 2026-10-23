import type {
  AttemptResult,
  AttemptResultListResponse,
  AttemptResultResponse,
} from '@exam-room/shared';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import type { Database } from '../../database/connection.js';
import { notFound } from '../../lib/http-errors.js';
import { parseInput } from '../../lib/parse-input.js';
import { requireTeacher } from '../auth/teacher-session.js';
import { closeNow } from '../tests/test-availability.js';
import type { TestRecord } from '../tests/test-record.js';
import { findTestById, saveTestSchedule } from '../tests/tests-repository.js';
import type { AttemptRecord } from './attempt-record.js';
import { summarizeAttempt } from './attempt-results.js';
import { endByTeacher, unlockByTeacher } from './attempt-rules.js';
import { changeAttempt } from './attempt-service.js';
import {
  deleteAttemptWithExits,
  findAttemptById,
  listAttemptsOfTest,
  listExitsOfTest,
  listStudentsWithoutAttempt,
} from './attempts-repository.js';

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

  async function requireTest(request: Request): Promise<TestRecord> {
    const { testId } = parseInput(testIdParamsSchema, request.params);
    const test = await findTestById(database, testId);
    if (!test) throw notFound('Test not found.');
    return test;
  }

  async function respondWithResults(response: Response, test: TestRecord): Promise<void> {
    const currentTime = clock.now();
    const attempts = await listAttemptsOfTest(database, test.id);
    const exitsByAttemptId = await listExitsOfTest(database, test.id);
    const notStarted = await listStudentsWithoutAttempt(database, test.schoolClass.id, test.id);

    response.json({
      attempts: attempts.map((attempt) =>
        summarizeAttempt(attempt, exitsByAttemptId.get(attempt.id) ?? [], currentTime),
      ),
      notStarted,
      serverTime: currentTime,
    } satisfies AttemptResultListResponse);
  }

  router.get('/', async (request, response) => {
    const test = await requireTest(request);
    await respondWithResults(response, test);
  });

  router.post('/end', async (request, response) => {
    const test = await requireTest(request);
    const currentTime = clock.now();

    for (const attempt of await listAttemptsOfTest(database, test.id)) {
      await changeAttempt(database, attempt, (current) => endByTeacher(current, currentTime));
    }
    const { opensAt, closesAt } = closeNow(test, currentTime);
    await saveTestSchedule(database, test.id, { opensAt, closesAt });

    await respondWithResults(response, test);
  });

  return router;
}

export function createTeacherAttemptsRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router();

  router.use(requireTeacher(dependencies));

  async function requireAttempt(request: Request): Promise<AttemptRecord> {
    const { attemptId } = parseInput(attemptIdParamsSchema, request.params);
    const attempt = await findAttemptById(database, attemptId);
    if (!attempt) throw notFound('Student attempt not found.');
    return attempt;
  }

  router.post('/:attemptId/unlock', async (request, response) => {
    const attempt = await requireAttempt(request);
    const unlockedAttempt = await changeAttempt(database, attempt, (current) =>
      unlockByTeacher(current, clock.now()),
    );
    response.json({
      attempt: await buildAttemptResult(database, unlockedAttempt, clock.now()),
    } satisfies AttemptResultResponse);
  });

  router.post('/:attemptId/end', async (request, response) => {
    const attempt = await requireAttempt(request);
    const endedAttempt = await changeAttempt(database, attempt, (current) =>
      endByTeacher(current, clock.now()),
    );
    response.json({
      attempt: await buildAttemptResult(database, endedAttempt, clock.now()),
    } satisfies AttemptResultResponse);
  });

  router.delete('/:attemptId', async (request, response) => {
    const attempt = await requireAttempt(request);
    await deleteAttemptWithExits(database, attempt.id);
    response.status(204).end();
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
