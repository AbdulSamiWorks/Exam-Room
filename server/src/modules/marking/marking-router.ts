import type {
  AttemptMarkingResponse,
  MarkingResponse,
  OfflineMarksResponse,
  ReleaseResultsResponse,
} from '@exam-room/shared';
import { UNIT_ID } from '@exam-room/shared/paper-rules';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import { badRequest, notFound } from '../../lib/http-errors.js';
import { idParams } from '../../lib/input-fields.js';
import { parseInput } from '../../lib/parse-input.js';
import { requireTeacher } from '../auth/teacher-session.js';
import { findAttemptById } from '../attempts/attempts-repository.js';
import { awardBounty } from '../points/bounty.js';
import { findPaperForStudents } from '../tests/paper-repository.js';
import type { TestRecord } from '../tests/test-record.js';
import { findTestById } from '../tests/tests-repository.js';
import { replaceQuestionMarks, saveRelease } from './marking-repository.js';
import { markAttempt, markTest } from './marking-service.js';
import { listOfflineMarks, saveOfflineMarks } from './offline-marks-repository.js';
import { marksProblem } from './score-attempt.js';

const MAX_COMMENT_LENGTH = 2000;

const saveMarksSchema = z.object({
  questionMarks: z.record(
    z.string().regex(UNIT_ID),
    z.object({
      marks: z.number().min(0).multipleOf(0.5, 'Marks can be whole or half marks.').nullable(),
      comment: z.string().trim().max(MAX_COMMENT_LENGTH),
    }),
  ),
  comment: z.string().trim().max(MAX_COMMENT_LENGTH),
});

const offlineMarksSchema = z.object({
  marks: z
    .array(
      z.object({
        studentId: z.number().int().positive(),
        marks: z.number().min(0).multipleOf(0.5, 'Marks can be whole or half marks.').nullable(),
      }),
    )
    .max(500),
});

const releaseSchema = z.object({
  showCorrectAnswers: z.boolean(),
  showComments: z.boolean(),
  showTopScorer: z.boolean(),
});

const testIdParamsSchema = idParams('testId');
const attemptIdParamsSchema = idParams('attemptId');

export function createTestMarkingRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router({ mergeParams: true });

  router.use(requireTeacher(dependencies));

  async function requireTest(request: Request): Promise<TestRecord> {
    const { testId } = parseInput(testIdParamsSchema, request.params);
    const test = await findTestById(database, testId);
    if (!test) throw notFound('Test not found.');
    return test;
  }

  router.get('/marking', async (request, response) => {
    const test = await requireTest(request);
    response.json((await markTest(database, test, clock.now())) satisfies MarkingResponse);
  });

  router.get('/offline-marks', async (request, response) => {
    const test = await requireTest(request);
    response.json({
      maxMarks: test.maxMarks ?? 0,
      students: await listOfflineMarks(database, test.schoolClass.id, test.id),
    } satisfies OfflineMarksResponse);
  });

  router.put('/offline-marks', async (request, response) => {
    const test = await requireTest(request);
    if (test.paperKind !== 'none') {
      throw badRequest('Marks are entered this way only for offline assignments.', 'not_offline');
    }
    const { marks } = parseInput(offlineMarksSchema, request.body);
    const students = await listOfflineMarks(database, test.schoolClass.id, test.id);
    const studentsById = new Map(students.map((student) => [student.studentId, student]));
    const maxMarks = test.maxMarks ?? 0;
    const toSave = marks.map((mark) => {
      const student = studentsById.get(mark.studentId);
      if (!student) throw badRequest('Choose students of this class.', 'student_not_found');
      if (mark.marks !== null && mark.marks > maxMarks) {
        throw badRequest(`Marks can be at most ${maxMarks}.`, 'invalid_marks');
      }
      return {
        studentId: student.studentId,
        studentName: student.name,
        rollNumber: student.rollNumber,
        marks: mark.marks,
      };
    });
    await saveOfflineMarks(database, test.id, toSave, clock.now());
    if (test.resultsReleasedAt !== null) await awardBounty(database, test, true, clock.now());
    response.json({
      maxMarks,
      students: await listOfflineMarks(database, test.schoolClass.id, test.id),
    } satisfies OfflineMarksResponse);
  });

  router.put('/release', async (request, response) => {
    const test = await requireTest(request);
    const releaseOptions = parseInput(releaseSchema, request.body);
    await markTest(database, test, clock.now());
    const releasedAt = test.resultsReleasedAt ?? clock.now();
    await saveRelease(database, test.id, releasedAt, releaseOptions);
    await awardBounty(database, test, true, clock.now());
    response.json({ releasedAt, releaseOptions } satisfies ReleaseResultsResponse);
  });

  router.delete('/release', async (request, response) => {
    const test = await requireTest(request);
    const marking = await markTest(database, test, clock.now());
    await saveRelease(database, test.id, null, marking.releaseOptions);
    await awardBounty(database, test, false, clock.now());
    response.json({
      releasedAt: null,
      releaseOptions: marking.releaseOptions,
    } satisfies ReleaseResultsResponse);
  });

  return router;
}

export function createAttemptMarksRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router({ mergeParams: true });

  router.use(requireTeacher(dependencies));

  router.put('/', async (request, response) => {
    const { attemptId } = parseInput(attemptIdParamsSchema, request.params);
    const attempt = await findAttemptById(database, attemptId);
    if (!attempt) throw notFound('Student attempt not found.');
    const { questionMarks, comment } = parseInput(saveMarksSchema, request.body);
    const paper = await findPaperForStudents(database, attempt.testId);
    if (!paper) throw badRequest('This test has no questions to mark.', 'paper_required');
    const problem = marksProblem(paper, questionMarks);
    if (problem) throw badRequest(problem, 'invalid_marks');

    await replaceQuestionMarks(database, attempt.id, questionMarks, comment);
    response.json({
      attempt: await markAttempt(database, attempt, clock.now()),
    } satisfies AttemptMarkingResponse);
  });

  return router;
}
