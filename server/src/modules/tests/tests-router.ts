import type { TestListResponse, TestResponse, TestSchedule } from '@exam-room/shared';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import { badRequest, notFound } from '../../lib/http-errors.js';
import { parseInput } from '../../lib/parse-input.js';
import { requireTeacher } from '../auth/teacher-session.js';
import { findSubjectById } from '../subjects/subjects-repository.js';
import { normalizePageImages } from './page-images.js';
import { receivePageImages, uploadedPageImages } from './receive-page-images.js';
import { closeNow, openNow, summarizeTest } from './test-availability.js';
import { createUniqueTestCode } from './test-code.js';
import { testLimits } from './test-limits.js';
import type { TestRecord } from './test-record.js';
import {
  findTestById,
  insertTestWithPages,
  listTests,
  saveTestSchedule,
} from './tests-repository.js';

const createTestFieldsSchema = z.object({
  subjectId: z.coerce.number().int().positive('Choose a subject.'),
  title: z
    .string()
    .trim()
    .min(1, 'Title is required.')
    .max(testLimits.maxTitleLength, `Use at most ${testLimits.maxTitleLength} characters.`),
  durationMinutes: z.coerce
    .number()
    .int('Time limit must be whole minutes.')
    .min(testLimits.minDurationMinutes, 'Time limit must be at least 1 minute.')
    .max(
      testLimits.maxDurationMinutes,
      `Time limit can be at most ${testLimits.maxDurationMinutes} minutes.`,
    ),
  allowedExits: z.coerce.number().pipe(z.literal([0, 1, 2], 'Allowed exits must be 0, 1 or 2.')),
});

const scheduleSchema = z
  .object({
    opensAt: z.number('Choose when the test opens.').int().positive(),
    closesAt: z.number().int().positive().nullable(),
  })
  .refine(
    (schedule) => schedule.closesAt === null || schedule.closesAt > schedule.opensAt,
    'The closing time must be after the opening time.',
  );

const testIdParamsSchema = z.object({
  testId: z.coerce.number().int().positive(),
});

const testListQuerySchema = z.object({
  subjectId: z.coerce.number().int().positive().optional(),
});

type DecideSchedule = (test: TestRecord, currentTime: number) => TestSchedule;

export function createTestsRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router();

  router.use(requireTeacher(dependencies));

  async function requireTest(request: Request): Promise<TestRecord> {
    const { testId } = parseInput(testIdParamsSchema, request.params);
    const test = await findTestById(database, testId);
    if (!test) throw notFound('Test not found.');
    return test;
  }

  async function changeSchedule(
    request: Request,
    response: Response,
    decideSchedule: DecideSchedule,
  ): Promise<void> {
    const test = await requireTest(request);
    const currentTime = clock.now();
    const { opensAt, closesAt } = decideSchedule(test, currentTime);
    await saveTestSchedule(database, test.id, { opensAt, closesAt });
    response.json({
      test: summarizeTest({ ...test, opensAt, closesAt }, currentTime),
    } satisfies TestResponse);
  }

  router.get('/', async (request, response) => {
    const filter = parseInput(testListQuerySchema, request.query);
    const tests = await listTests(database, filter);
    const currentTime = clock.now();
    response.json({
      tests: tests.map((test) => summarizeTest(test, currentTime)),
    } satisfies TestListResponse);
  });

  router.post('/', receivePageImages, async (request, response) => {
    const fields = parseInput(createTestFieldsSchema, request.body);
    const pageImages = uploadedPageImages(request.files);
    if (pageImages.length === 0) {
      throw badRequest('Add the test paper.', 'pages_required');
    }

    const subject = await findSubjectById(database, fields.subjectId);
    if (!subject) throw badRequest('Choose a subject.', 'subject_not_found');

    const pages = await normalizePageImages(pageImages);
    const testId = await insertTestWithPages(
      database,
      {
        code: await createUniqueTestCode(database),
        subjectId: subject.id,
        title: fields.title,
        durationMinutes: fields.durationMinutes,
        allowedExits: fields.allowedExits,
        createdAt: clock.now(),
      },
      pages,
    );

    const test = await findTestById(database, testId);
    if (!test) throw new Error('A newly created test could not be read back.');
    response.status(201).json({ test: summarizeTest(test, clock.now()) } satisfies TestResponse);
  });

  router.get('/:testId', async (request, response) => {
    const test = await requireTest(request);
    response.json({ test: summarizeTest(test, clock.now()) } satisfies TestResponse);
  });

  router.post('/:testId/open', async (request, response) => {
    await changeSchedule(request, response, openNow);
  });

  router.post('/:testId/close', async (request, response) => {
    await changeSchedule(request, response, closeNow);
  });

  router.put('/:testId/schedule', async (request, response) => {
    const schedule = parseInput(scheduleSchema, request.body);
    await changeSchedule(request, response, () => schedule);
  });

  return router;
}
