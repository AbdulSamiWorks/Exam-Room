import type { TestListResponse, TestResponse, TestSchedule } from '@exam-room/shared';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import type { Database } from '../../database/connection.js';
import { badRequest, conflict, notFound } from '../../lib/http-errors.js';
import { atLeastOneChange, idParams, positiveId } from '../../lib/input-fields.js';
import { parseInput } from '../../lib/parse-input.js';
import { requireTeacher } from '../auth/teacher-session.js';
import { findChapterIdsInSubject } from '../chapters/chapters-repository.js';
import { findSubjectById } from '../subjects/subjects-repository.js';
import { normalizePageImages } from './page-images.js';
import { receivePageImages, uploadedPageImages } from './receive-page-images.js';
import { closeNow, openNow, summarizeTest } from './test-availability.js';
import { createUniqueTestCode } from './test-code.js';
import { testLimits } from './test-limits.js';
import type { TestWithChapters } from './test-record.js';
import {
  applySettingChanges,
  chapterIdsAfterChange,
  changesFixedSettings,
} from './test-settings.js';
import {
  deleteTestWithResults,
  findTestWithChapters,
  insertTestWithPages,
  listTests,
  replacePagesBeforeAnyStart,
  saveTestSchedule,
  saveTestSettings,
} from './tests-repository.js';

const COMMA = ',';

const chapterIdsField = z
  .preprocess(
    (value) => (typeof value === 'string' ? value.split(COMMA).filter(Boolean) : value),
    z
      .array(positiveId)
      .max(
        testLimits.maxChaptersPerTest,
        `Choose at most ${testLimits.maxChaptersPerTest} chapters.`,
      ),
  )
  .transform((chapterIds) => [...new Set(chapterIds)]);

const testSettingsFields = {
  subjectId: z.coerce.number().int().positive('Choose a subject.'),
  kind: z.enum(['test', 'quiz'], 'Choose test or quiz.'),
  chapterIds: chapterIdsField,
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
  leaveRule: z.enum(['lock', 'finish'], 'Choose what happens when a student leaves.'),
};

const createTestFieldsSchema = z.object({
  ...testSettingsFields,
  kind: testSettingsFields.kind.default('test'),
  chapterIds: testSettingsFields.chapterIds.default([]),
  leaveRule: testSettingsFields.leaveRule.default('lock'),
});

const updateTestSchema = z
  .object(testSettingsFields)
  .partial()
  .refine(atLeastOneChange, 'Nothing to change.');

const STARTED_TEST_SETTINGS_MESSAGE =
  'Students have already started this test. Now you can only change the title, type, subject and chapters.';
const STARTED_TEST_PAPER_MESSAGE =
  'Students have already started this test, so the paper cannot be replaced.';

const scheduleSchema = z
  .object({
    opensAt: z.number('Choose when the test opens.').int().positive(),
    closesAt: z.number().int().positive().nullable(),
  })
  .refine(
    (schedule) => schedule.closesAt === null || schedule.closesAt > schedule.opensAt,
    'The closing time must be after the opening time.',
  );

const testIdParamsSchema = idParams('testId');

const testListQuerySchema = z.object({
  subjectId: positiveId.optional(),
});

type DecideSchedule = (test: TestWithChapters, currentTime: number) => TestSchedule;

export function createTestsRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router();

  router.use(requireTeacher(dependencies));

  async function requireTest(request: Request): Promise<TestWithChapters> {
    const { testId } = parseInput(testIdParamsSchema, request.params);
    const test = await findTestWithChapters(database, testId);
    if (!test) throw notFound('Test not found.');
    return test;
  }

  async function respondWithTest(response: Response, testId: number, status = 200) {
    const test = await findTestWithChapters(database, testId);
    if (!test) throw notFound('Test not found.');
    response.status(status).json({ test: summarizeTest(test, clock.now()) } satisfies TestResponse);
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

    await requireSubjectWithChapters(database, fields.subjectId, fields.chapterIds);

    const pages = await normalizePageImages(pageImages);
    const testId = await insertTestWithPages(
      database,
      { ...fields, code: await createUniqueTestCode(database), createdAt: clock.now() },
      pages,
    );
    await respondWithTest(response, testId, 201);
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

  router.patch('/:testId', async (request, response) => {
    const test = await requireTest(request);
    const changes = parseInput(updateTestSchema, request.body);
    if (changesFixedSettings(test, changes)) {
      throw conflict(STARTED_TEST_SETTINGS_MESSAGE, 'test_already_started');
    }

    const settings = applySettingChanges(test, changes);
    const chapterIds = chapterIdsAfterChange(test, changes);
    await requireSubjectWithChapters(database, settings.subjectId, chapterIds ?? []);

    await saveTestSettings(database, test.id, settings, chapterIds);
    await respondWithTest(response, test.id);
  });

  router.put('/:testId/pages', receivePageImages, async (request, response) => {
    const test = await requireTest(request);
    const pageImages = uploadedPageImages(request.files);
    if (pageImages.length === 0) throw badRequest('Add the test paper.', 'pages_required');
    if (test.studentCount > 0) throw conflict(STARTED_TEST_PAPER_MESSAGE, 'test_already_started');

    const pages = await normalizePageImages(pageImages);
    if (!(await replacePagesBeforeAnyStart(database, test.id, pages))) {
      throw conflict(STARTED_TEST_PAPER_MESSAGE, 'test_already_started');
    }
    await respondWithTest(response, test.id);
  });

  router.delete('/:testId', async (request, response) => {
    const test = await requireTest(request);
    await deleteTestWithResults(database, test.id);
    response.status(204).end();
  });

  return router;
}

async function requireSubjectWithChapters(
  database: Database,
  subjectId: number,
  chapterIds: readonly number[],
): Promise<void> {
  if (!(await findSubjectById(database, subjectId))) {
    throw badRequest('Choose a subject.', 'subject_not_found');
  }
  const foundChapterIds = await findChapterIdsInSubject(database, subjectId, chapterIds);
  if (foundChapterIds.length !== chapterIds.length) {
    throw badRequest('Choose chapters of the chosen subject.', 'chapter_not_found');
  }
}
