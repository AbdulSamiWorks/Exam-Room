import type {
  TeacherPaperResponse,
  TestListResponse,
  TestResponse,
  TestSchedule,
} from '@exam-room/shared';
import { answerKeyProblems, answerKeySchema, paperSchema } from '@exam-room/shared/paper-rules';
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
import { markTest } from '../marking/marking-service.js';
import { checkedPaper, checkPaperImageSizes } from './checked-paper.js';
import { normalizePageImages, normalizePaperImages } from './page-images.js';
import {
  findPaperImage,
  findStoredPaper,
  replacePaperBeforeAnyStart,
  saveAnswerKey,
} from './paper-repository.js';
import { receiveTestUpload, uploadedImages } from './receive-test-upload.js';
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
  insertTest,
  listTests,
  replacePagesBeforeAnyStart,
  saveTestSchedule,
  saveTestSettings,
  type TestContent,
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

function booleanField(message: string) {
  return z.preprocess(
    (value) => (value === 'true' ? true : value === 'false' ? false : value),
    z.boolean(message),
  );
}

const testSettingsFields = {
  subjectId: z.coerce.number().int().positive('Choose a subject.'),
  kind: z.enum(['test', 'quiz', 'assignment'], 'Choose test, quiz or assignment.'),
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
  writtenAnswers: z.enum(
    ['on_paper', 'typed', 'photos', 'typed_and_photos'],
    'Choose how students answer written questions.',
  ),
  bountyNote: z
    .string()
    .trim()
    .max(
      testLimits.maxBountyNoteLength,
      `Use at most ${testLimits.maxBountyNoteLength} characters.`,
    ),
  bountyPoints: z.coerce
    .number()
    .int('Points must be a whole number.')
    .min(0)
    .max(testLimits.maxBountyPoints, `At most ${testLimits.maxBountyPoints} points.`),
  waitingRoom: booleanField('Choose whether students wait for you to start.'),
  instantMcqResult: booleanField('Choose when students see their multiple choice result.'),
};

function jsonText<Schema extends z.ZodType>(schema: Schema, unreadableMessage: string) {
  return z.preprocess((value, context) => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      context.addIssue({ code: 'custom', message: unreadableMessage });
      return z.NEVER;
    }
  }, schema);
}

const paperFields = {
  paper: jsonText(paperSchema, 'The paper could not be read.'),
  answerKey: jsonText(answerKeySchema, 'The answer key could not be read.').default({}),
};

const createTestFieldsSchema = z.object({
  ...testSettingsFields,
  kind: testSettingsFields.kind.default('test'),
  chapterIds: testSettingsFields.chapterIds.default([]),
  leaveRule: testSettingsFields.leaveRule.default('lock'),
  writtenAnswers: testSettingsFields.writtenAnswers.default('on_paper'),
  bountyNote: testSettingsFields.bountyNote.default(''),
  bountyPoints: testSettingsFields.bountyPoints.default(0),
  waitingRoom: testSettingsFields.waitingRoom.default(false),
  instantMcqResult: testSettingsFields.instantMcqResult.default(true),
  paperKind: z.enum(['pages', 'typed', 'none']).default('pages'),
  maxMarks: z.coerce
    .number()
    .positive('Enter the total marks.')
    .max(testLimits.maxOfflineMarks)
    .multipleOf(0.5, 'Marks can be whole or half marks.')
    .optional(),
  paper: paperFields.paper.optional(),
  answerKey: paperFields.answerKey,
});

type CreateTestFields = z.output<typeof createTestFieldsSchema>;

const paperUploadSchema = z.object(paperFields);

const answerKeyRequestSchema = z.object({ answerKey: answerKeySchema });

const imageParamsSchema = z.object({ imageNumber: positiveId });

const updateTestSchema = z
  .object(testSettingsFields)
  .partial()
  .refine(atLeastOneChange, 'Nothing to change.');

const STARTED_TEST_SETTINGS_MESSAGE =
  'Students have already started this test. Now you can only change the title, type, subject, chapters and bounty.';
const STARTED_TEST_PAPER_MESSAGE =
  'Students have already started this test, so the paper cannot be replaced.';

function settingsOfNewTest(fields: CreateTestFields) {
  const { subjectId, kind, chapterIds, title, durationMinutes, allowedExits } = fields;
  const { leaveRule, writtenAnswers, bountyNote, bountyPoints, waitingRoom, instantMcqResult } =
    fields;
  return {
    subjectId,
    kind,
    chapterIds,
    title,
    durationMinutes,
    allowedExits,
    leaveRule,
    writtenAnswers,
    bountyNote,
    bountyPoints,
    waitingRoom,
    instantMcqResult,
  };
}

async function testContentOf(fields: CreateTestFields, files: unknown): Promise<TestContent> {
  if (fields.paperKind === 'none') {
    if (fields.kind !== 'assignment') {
      throw badRequest('Only an assignment can be done without a paper.', 'paper_required');
    }
    if (fields.maxMarks === undefined) throw badRequest('Enter the total marks.', 'marks_required');
    return { paperKind: 'none', maxMarks: fields.maxMarks };
  }
  if (fields.paperKind === 'typed') {
    if (!fields.paper) throw badRequest('Add the questions of the paper.', 'paper_required');
    const images = uploadedImages(files, 'paperImages');
    checkPaperImageSizes(images);
    return {
      paperKind: 'typed',
      typedPaper: checkedPaper(fields.paper, fields.answerKey, images.length),
      paperImages: await normalizePaperImages(images),
    };
  }

  const pageImages = uploadedImages(files, 'pages');
  if (pageImages.length === 0) throw badRequest('Add the test paper.', 'pages_required');
  return {
    paperKind: 'pages',
    pages: await normalizePageImages(pageImages),
    answerSheet: fields.paper && checkedPaper(fields.paper, fields.answerKey, 0),
  };
}

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

  router.post('/', receiveTestUpload, async (request, response) => {
    const fields = parseInput(createTestFieldsSchema, request.body);
    const settings = settingsOfNewTest(fields);
    await requireSubjectWithChapters(database, settings.subjectId, settings.chapterIds);

    const content = await testContentOf(fields, request.files);
    const testId = await insertTest(
      database,
      { ...settings, code: await createUniqueTestCode(database), createdAt: clock.now() },
      content,
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

    if (test.paperKind === 'none' && changes.kind !== undefined && changes.kind !== 'assignment') {
      throw badRequest('A test without a paper must stay an assignment.', 'paper_required');
    }
    const settings = applySettingChanges(test, changes);
    const chapterIds = chapterIdsAfterChange(test, changes);
    await requireSubjectWithChapters(database, settings.subjectId, chapterIds ?? []);

    await saveTestSettings(database, test.id, settings, chapterIds);
    await respondWithTest(response, test.id);
  });

  router.put('/:testId/pages', receiveTestUpload, async (request, response) => {
    const test = await requireTest(request);
    const pageImages = uploadedImages(request.files, 'pages');
    if (test.paperKind !== 'pages') throw badRequest('This test has a typed paper.', 'typed_paper');
    if (pageImages.length === 0) throw badRequest('Add the test paper.', 'pages_required');
    if (test.studentCount > 0) throw conflict(STARTED_TEST_PAPER_MESSAGE, 'test_already_started');

    const pages = await normalizePageImages(pageImages);
    if (!(await replacePagesBeforeAnyStart(database, test.id, pages))) {
      throw conflict(STARTED_TEST_PAPER_MESSAGE, 'test_already_started');
    }
    await respondWithTest(response, test.id);
  });

  router.get('/:testId/paper', async (request, response) => {
    const test = await requireTest(request);
    response.json((await findStoredPaper(database, test.id)) satisfies TeacherPaperResponse);
  });

  router.put('/:testId/paper', receiveTestUpload, async (request, response) => {
    const test = await requireTest(request);
    const { paper, answerKey } = parseInput(paperUploadSchema, request.body);
    if (test.studentCount > 0) throw conflict(STARTED_TEST_PAPER_MESSAGE, 'test_already_started');

    const images = test.paperKind === 'typed' ? uploadedImages(request.files, 'paperImages') : [];
    checkPaperImageSizes(images);
    const storedPaper = checkedPaper(paper, answerKey, images.length);
    const paperImages = await normalizePaperImages(images);
    if (!(await replacePaperBeforeAnyStart(database, test.id, storedPaper, paperImages))) {
      throw conflict(STARTED_TEST_PAPER_MESSAGE, 'test_already_started');
    }
    await respondWithTest(response, test.id);
  });

  router.put('/:testId/answer-key', async (request, response) => {
    const test = await requireTest(request);
    const { answerKey } = parseInput(answerKeyRequestSchema, request.body);
    const { paper } = await findStoredPaper(database, test.id);
    if (!paper) throw badRequest('This test has no questions yet.', 'paper_required');
    const [firstProblem] = answerKeyProblems(paper, answerKey);
    if (firstProblem) throw badRequest(firstProblem, 'invalid_answer_key');

    await saveAnswerKey(database, test.id, answerKey);
    await markTest(database, test, clock.now());
    response.json((await findStoredPaper(database, test.id)) satisfies TeacherPaperResponse);
  });

  router.get('/:testId/paper-images/:imageNumber', async (request, response) => {
    const test = await requireTest(request);
    const { imageNumber } = parseInput(imageParamsSchema, request.params);
    const image = await findPaperImage(database, test.id, imageNumber);
    if (!image) throw notFound('This picture does not exist.');
    response.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'no-store' }).send(image);
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
