import type { AttemptResponse } from '@exam-room/shared';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import { sha256 } from '../../lib/crypto.js';
import { HttpError, notFound } from '../../lib/http-errors.js';
import { parseInput } from '../../lib/parse-input.js';
import { findPageImage } from '../tests/tests-repository.js';
import type { AttemptRecord } from './attempt-record.js';
import { finishByStudent } from './attempt-rules.js';
import { changeAttempt, enforceTimeLimit } from './attempt-service.js';
import { readBearerToken } from './attempt-token.js';
import { findAttemptByTokenHash } from './attempts-repository.js';
import { buildStudentAttempt, findTestOfAttempt } from './student-attempt-view.js';

const pageParamsSchema = z.object({
  pageNumber: z.coerce.number().int().positive(),
});

export function createAttemptRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router();

  async function loadAttempt(request: Request): Promise<AttemptRecord> {
    const attemptToken = readBearerToken(request.headers.authorization);
    const attempt = attemptToken
      ? await findAttemptByTokenHash(database, sha256(attemptToken))
      : undefined;
    if (!attempt) {
      throw new HttpError(
        401,
        'attempt_not_found',
        'Your test session was not found. Open the test link again.',
      );
    }
    return enforceTimeLimit(database, attempt, clock.now());
  }

  async function respondWithAttempt(response: Response, attempt: AttemptRecord): Promise<void> {
    const test = await findTestOfAttempt(database, attempt);
    const studentAttempt = await buildStudentAttempt(database, attempt, test, clock.now());
    response.json({ attempt: studentAttempt } satisfies AttemptResponse);
  }

  router.get('/', async (request, response) => {
    await respondWithAttempt(response, await loadAttempt(request));
  });

  router.get('/pages/:pageNumber', async (request, response) => {
    const attempt = await loadAttempt(request);
    if (attempt.status !== 'in_progress') {
      throw new HttpError(410, 'paper_closed', 'The test is closed.');
    }

    const { pageNumber } = parseInput(pageParamsSchema, request.params);
    const pageImage = await findPageImage(database, attempt.testId, pageNumber);
    if (!pageImage) throw notFound('This page does not exist.');

    response.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'no-store' }).send(pageImage);
  });

  router.post('/finish', async (request, response) => {
    const attempt = await loadAttempt(request);
    const finishedAttempt = await changeAttempt(database, attempt, (current) =>
      finishByStudent(current, clock.now()),
    );
    await respondWithAttempt(response, finishedAttempt);
  });

  return router;
}
