import type { PublicTestResponse, StartAttemptResponse } from '@exam-room/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import { sha256 } from '../../lib/crypto.js';
import { forbidden, notFound, tooManyRequests } from '../../lib/http-errors.js';
import { parseInput } from '../../lib/parse-input.js';
import { findTestByCode } from '../tests/tests-repository.js';
import { startOrResumeAttempt } from './attempt-service.js';
import { createAttemptToken } from './attempt-token.js';
import { buildStudentAttempt, toPublicTest } from './student-attempt-view.js';
import { requireSessionStudent } from '../student-auth/student-session.js';

const START_WINDOW_MS = 5 * 60 * 1000;
const MAX_STARTS_PER_WINDOW = 60;

const testCodeParamsSchema = z.object({
  testCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/, 'Check the test link.'),
});

export function createPublicTestsRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router();

  const startAttemptLimiter = rateLimit({
    windowMs: START_WINDOW_MS,
    limit: MAX_STARTS_PER_WINDOW,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, _response, next) => {
      next(tooManyRequests('Too many tries. Please wait a few minutes.'));
    },
  });

  async function requireTestByCode(testCode: string) {
    const test = await findTestByCode(database, testCode);
    if (!test) throw notFound('This test does not exist. Check the link.', 'test_not_found');
    return test;
  }

  router.get('/:testCode', async (request, response) => {
    const { testCode } = parseInput(testCodeParamsSchema, request.params);
    const test = await requireTestByCode(testCode);
    response.json({ test: toPublicTest(test, clock.now()) } satisfies PublicTestResponse);
  });

  router.post('/:testCode/attempts', startAttemptLimiter, async (request, response) => {
    const { testCode } = parseInput(testCodeParamsSchema, request.params);
    const student = await requireSessionStudent(dependencies, request);
    const test = await requireTestByCode(testCode);
    if (test.subject.classId !== student.schoolClass.id) {
      throw forbidden(
        `This test is for ${test.schoolClass.name}. You are in ${student.schoolClass.name}.`,
        'other_class',
      );
    }

    const attemptToken = createAttemptToken();
    const currentTime = clock.now();
    const attempt = await startOrResumeAttempt(database, {
      test,
      student,
      tokenHash: sha256(attemptToken),
      currentTime,
    });

    response.status(201).json({
      attemptToken,
      attempt: await buildStudentAttempt(database, attempt, test, currentTime),
    } satisfies StartAttemptResponse);
  });

  return router;
}
