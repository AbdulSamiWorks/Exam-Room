import type {
  AnswerChange,
  AttemptResponse,
  SaveAnswersResponse,
  StoredAnswersResponse,
  StudentPaperResponse,
} from '@exam-room/shared';
import { numberQuestions } from '@exam-room/shared/paper-rules';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import { retryTransientErrors } from '../../database/transient-errors.js';
import { sha256 } from '../../lib/crypto.js';
import { badRequest, HttpError, notFound } from '../../lib/http-errors.js';
import { parseInput } from '../../lib/parse-input.js';
import type { TestRecord } from '../tests/test-record.js';
import { answerProblem, isAcceptingAnswers, isAnswerInTime } from '../answers/answer-rules.js';
import { listAnswersOfAttempt, saveAnswers } from '../answers/answers-repository.js';
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

const MAX_ANSWERS_PER_REQUEST = 200;
const MAX_ANSWER_TEXT_LENGTH = 5000;
const MAX_SEQUENCE = Number.MAX_SAFE_INTEGER;

const saveAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().regex(/^q\d{1,4}$/),
        choice: z.number().int().min(0).nullable(),
        text: z.string().max(MAX_ANSWER_TEXT_LENGTH).nullable(),
        sequence: z.number().int().positive().max(MAX_SEQUENCE),
        answeredAt: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(MAX_ANSWERS_PER_REQUEST),
});

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

  router.get('/answers', async (request, response) => {
    const attempt = await loadAttemptWithOpenPaper(request);
    const answers = await listAnswersOfAttempt(database, attempt.id);
    response.json({ answers } satisfies StoredAnswersResponse);
  });

  router.post('/answers', async (request, response) => {
    const attempt = await loadAttempt(request);
    const { answers } = parseInput(saveAnswersSchema, request.body);
    const receivedAt = clock.now();
    if (!isAcceptingAnswers(attempt, receivedAt)) {
      response.json({
        savedCount: 0,
        tooLateCount: answers.length,
        serverTime: receivedAt,
      } satisfies SaveAnswersResponse);
      return;
    }

    const [test, paper] = await Promise.all([
      findTestOfAttempt(database, attempt),
      findPaperForStudents(database, attempt.testId),
    ]);
    const questionsById = new Map(
      numberQuestions(paper ?? { instructions: '', sections: [] }).map((question) => [
        question.id,
        question,
      ]),
    );
    for (const change of answers) {
      const problem = answerProblem(
        questionsById.get(change.questionId),
        change,
        test.writtenAnswers,
      );
      if (problem) throw badRequest(problem, 'invalid_answer');
    }

    const inTime: AnswerChange[] = answers.filter((change) =>
      isAnswerInTime(attempt, change.answeredAt, receivedAt),
    );
    await retryTransientErrors(() => saveAnswers(database, attempt.id, inTime, receivedAt));
    response.json({
      savedCount: inTime.length,
      tooLateCount: answers.length - inTime.length,
      serverTime: receivedAt,
    } satisfies SaveAnswersResponse);
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
    const finishedAttempt = await retryTransientErrors(() =>
      changeAttempt(database, attempt, (current) => finishByStudent(current, clock.now())),
    );
    await respondWithAttempt(response, finishedAttempt);
  });

  return router;
}
