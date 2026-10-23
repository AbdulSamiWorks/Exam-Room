import type { AttemptResponse, StudentPaperResponse } from '@exam-room/shared';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import { sha256 } from '../../lib/crypto.js';
import { HttpError, notFound } from '../../lib/http-errors.js';
import { parseInput } from '../../lib/parse-input.js';
import type { TestRecord } from '../tests/test-record.js';
import { findPaperForStudents, findPaperImage } from '../tests/paper-repository.js';
import { findPageImage } from '../tests/tests-repository.js';
import type { AttemptRecord } from './attempt-record.js';
import { finishByStudent } from './attempt-rules.js';
import { changeAttempt, enforceTimeLimit, recordExit, recordReturn } from './attempt-service.js';
import { readBearerToken } from './attempt-token.js';
import { findAttemptByTokenHash } from './attempts-repository.js';
import { buildStudentAttempt, findTestOfAttempt } from './student-attempt-view.js';

const MAX_REPORTED_AWAY_MS = 24 * 60 * 60 * 1000;

const pageParamsSchema = z.object({
  pageNumber: z.coerce.number().int().positive(),
});

const imageParamsSchema = z.object({
  imageNumber: z.coerce.number().int().positive(),
});

const IMAGE_HEADERS = { 'Content-Type': 'image/webp', 'Cache-Control': 'no-store' };

const exitReportSchema = z.object({
  clientExitId: z.string().regex(/^[\w-]{8,64}$/, 'Invalid exit id.'),
  reason: z.enum(['hidden', 'blur', 'fullscreen']),
});

const returnReportSchema = exitReportSchema.extend({
  awayMsClient: z.number().int().min(0).max(MAX_REPORTED_AWAY_MS),
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

  async function respondWithAttempt(
    response: Response,
    attempt: AttemptRecord,
    knownTest?: TestRecord,
  ): Promise<void> {
    const test = knownTest ?? (await findTestOfAttempt(database, attempt));
    const studentAttempt = await buildStudentAttempt(database, attempt, test, clock.now());
    response.json({ attempt: studentAttempt } satisfies AttemptResponse);
  }

  async function loadAttemptWithOpenPaper(request: Request): Promise<AttemptRecord> {
    const attempt = await loadAttempt(request);
    if (attempt.status !== 'in_progress') {
      throw new HttpError(410, 'paper_closed', 'The test is closed.');
    }
    return attempt;
  }

  router.get('/', async (request, response) => {
    await respondWithAttempt(response, await loadAttempt(request));
  });

  router.get('/pages/:pageNumber', async (request, response) => {
    const attempt = await loadAttemptWithOpenPaper(request);
    const { pageNumber } = parseInput(pageParamsSchema, request.params);
    const pageImage = await findPageImage(database, attempt.testId, pageNumber);
    if (!pageImage) throw notFound('This page does not exist.');
    response.set(IMAGE_HEADERS).send(pageImage);
  });

  router.get('/paper', async (request, response) => {
    const attempt = await loadAttemptWithOpenPaper(request);
    const paper = await findPaperForStudents(database, attempt.testId);
    if (!paper) throw notFound('This test has no typed questions.', 'paper_not_found');
    response.set('Cache-Control', 'no-store').json({ paper } satisfies StudentPaperResponse);
  });

  router.get('/paper-images/:imageNumber', async (request, response) => {
    const attempt = await loadAttemptWithOpenPaper(request);
    const { imageNumber } = parseInput(imageParamsSchema, request.params);
    const image = await findPaperImage(database, attempt.testId, imageNumber);
    if (!image) throw notFound('This picture does not exist.');
    response.set(IMAGE_HEADERS).send(image);
  });

  router.post('/exits', async (request, response) => {
    const attempt = await loadAttempt(request);
    const exitReport = parseInput(exitReportSchema, request.body);
    const test = await findTestOfAttempt(database, attempt);

    const updatedAttempt = await recordExit(
      database,
      attempt,
      { ...exitReport, exitRules: test },
      clock.now(),
    );
    await respondWithAttempt(response, updatedAttempt, test);
  });

  router.post('/return', async (request, response) => {
    const attempt = await loadAttempt(request);
    const returnReport = parseInput(returnReportSchema, request.body);
    const test = await findTestOfAttempt(database, attempt);

    const updatedAttempt = await recordReturn(
      database,
      attempt,
      { ...returnReport, exitRules: test },
      clock.now(),
    );
    await respondWithAttempt(response, updatedAttempt, test);
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
