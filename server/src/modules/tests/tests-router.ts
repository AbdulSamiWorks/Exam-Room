import type { TestListResponse, TestResponse } from '@exam-room/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import { badRequest, notFound } from '../../lib/http-errors.js';
import { parseInput } from '../../lib/parse-input.js';
import { requireTeacher } from '../auth/teacher-session.js';
import { findSubjectById } from '../subjects/subjects-repository.js';
import { normalizePageImages } from './page-images.js';
import { receivePageImages, uploadedPageImages } from './receive-page-images.js';
import { createUniqueTestCode } from './test-code.js';
import { testLimits } from './test-limits.js';
import { findTestById, insertTestWithPages, listTests } from './tests-repository.js';

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

const testIdParamsSchema = z.object({
  testId: z.coerce.number().int().positive(),
});

const testListQuerySchema = z.object({
  subjectId: z.coerce.number().int().positive().optional(),
});

export function createTestsRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router();

  router.use(requireTeacher(dependencies));

  router.get('/', async (request, response) => {
    const filter = parseInput(testListQuerySchema, request.query);
    const tests = await listTests(database, filter);
    response.json({ tests } satisfies TestListResponse);
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
    response.status(201).json({ test } satisfies TestResponse);
  });

  router.get('/:testId', async (request, response) => {
    const { testId } = parseInput(testIdParamsSchema, request.params);
    const test = await findTestById(database, testId);
    if (!test) throw notFound('Test not found.');
    response.json({ test } satisfies TestResponse);
  });

  return router;
}
