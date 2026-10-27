import type { StudentAttempt, TestSummary } from '@exam-room/shared';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sha256 } from '../src/lib/crypto.js';
import { finishByStudent } from '../src/modules/attempts/attempt-rules.js';
import { changeAttempt } from '../src/modules/attempts/attempt-service.js';
import { findAttemptByTokenHash } from '../src/modules/attempts/attempts-repository.js';
import {
  classIdOfTest,
  logInAsStudent,
  publishTest,
  startAttempt,
  startAttemptToken,
  STUDENT,
  studentRequests,
} from './support/exam-fixtures.js';
import { createBlankPageImage, isWebpImage } from './support/page-image-fixtures.js';
import { logInAsTeacher } from './support/teacher-agent.js';
import { createTestContext, TEST_START_TIME, type TestContext } from './support/test-context.js';

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

describe('student attempts', () => {
  let context: TestContext;
  let portraitPage: Buffer;
  let landscapePage: Buffer;

  beforeAll(async () => {
    portraitPage = await createBlankPageImage(800, 1100);
    landscapePage = await createBlankPageImage(1000, 700);
  });

  beforeEach(async () => {
    context = await createTestContext();
  });
  afterEach(() => context.cleanUp());

  async function publishTwoPageTest(settings: Parameters<typeof publishTest>[1] = {}) {
    return publishTest(context.app, { pageImages: [portraitPage, landscapePage], ...settings });
  }

  async function readExits(): Promise<Array<{ reason: unknown }>> {
    const { rows } = await context.database.execute('SELECT reason FROM exits');
    return rows.map((row) => ({ reason: row.reason }));
  }

  describe('public test details', () => {
    it('shows what a student needs before starting', async () => {
      const test = await publishTwoPageTest({ durationMinutes: 45, allowedExits: 2 });

      const response = await request(context.app).get(`/api/public/tests/${test.code}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        test: {
          code: test.code,
          kind: 'test',
          title: 'Chapter 3 Quiz',
          subjectName: test.subject.name,
          durationMinutes: 45,
          allowedExits: 2,
          leaveRule: 'lock',
          paperKind: 'pages',
          pageCount: 2,
          questionCount: 0,
          maxMarks: null,
          writtenAnswers: 'on_paper',
          bountyNote: '',
          bountyPoints: 0,
          waitingRoom: false,
          instantResult: true,
          opensAt: TEST_START_TIME,
          closesAt: null,
          availability: 'open',
          chapterNames: [],
        },
      });
    });

    it('accepts the test code in lower case', async () => {
      const test = await publishTwoPageTest();
      const response = await request(context.app).get(
        `/api/public/tests/${test.code.toLowerCase()}`,
      );
      expect(response.status).toBe(200);
    });

    it('returns 404 for an unknown test code', async () => {
      const response = await request(context.app).get('/api/public/tests/ZZZZZZ');
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('test_not_found');
    });

    it('rejects a malformed test code', async () => {
      const response = await request(context.app).get('/api/public/tests/abc');
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('invalid_input');
    });
  });

  describe('starting', () => {
    let test: TestSummary;

    beforeEach(async () => {
      test = await publishTwoPageTest();
    });

    it('starts an attempt and returns a secret token with the exam state', async () => {
      const response = await startAttempt(context.app, test.code);

      expect(response.status).toBe(201);
      expect(response.body.attemptToken).toEqual(expect.stringMatching(/^[\w-]{43}$/));
      expect(response.body.attempt).toEqual({
        status: 'in_progress',
        finishReason: null,
        studentName: 'Ayesha Khan',
        rollNumber: '17',
        test: {
          code: test.code,
          kind: 'test',
          title: test.title,
          subjectName: test.subject.name,
          durationMinutes: 30,
          allowedExits: 1,
          leaveRule: 'lock',
          paperKind: 'pages',
          pageCount: 2,
          questionCount: 0,
          maxMarks: null,
          writtenAnswers: 'on_paper',
          bountyNote: '',
          bountyPoints: 0,
          waitingRoom: false,
          instantResult: true,
          opensAt: TEST_START_TIME,
          closesAt: null,
          availability: 'open',
        },
        pageSizes: [
          { width: 800, height: 1100 },
          { width: 1000, height: 700 },
        ],
        startedAt: TEST_START_TIME,
        deadlineAt: TEST_START_TIME + THIRTY_MINUTES_MS,
        exitsUsed: 0,
        serverTime: TEST_START_TIME,
      } satisfies StudentAttempt);
    });

    it('stores only a hash of the token', async () => {
      const attemptToken = await startAttemptToken(context.app, test.code);
      const { rows } = await context.database.execute('SELECT token_hash FROM attempts');
      expect(rows.map((row) => row.token_hash)).toEqual([sha256(attemptToken)]);
    });

    it('counts the student on the teacher dashboard', async () => {
      await startAttemptToken(context.app, test.code);
      const teacher = await logInAsTeacher(context.app);
      const response = await teacher.get(`/api/tests/${test.id}`);
      expect(response.body.test.studentCount).toBe(1);
    });

    it('needs a student login', async () => {
      const response = await request(context.app).post(`/api/public/tests/${test.code}/attempts`);
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('student_login_needed');
    });

    it('refuses a student of another class', async () => {
      const otherTest = await publishTwoPageTest();
      const student = await logInAsStudent(context.app, classIdOfTest(context.app, otherTest.code));

      const response = await student.post(`/api/public/tests/${test.code}/attempts`);
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('other_class');
    });

    it('returns 404 when the test does not exist', async () => {
      const student = await logInAsStudent(context.app, classIdOfTest(context.app, test.code));
      const response = await student.post('/api/public/tests/ZZZZZZ/attempts');
      expect(response.status).toBe(404);
    });

    it('links the attempt to the student account', async () => {
      await startAttemptToken(context.app, test.code);
      const { rows } = await context.database.execute(
        'SELECT attempts.student_id, students.name FROM attempts JOIN students ON students.id = attempts.student_id',
      );
      expect(rows.map((row) => row.name)).toEqual([STUDENT.studentName]);
    });
  });

  describe('reading the attempt', () => {
    it('returns the state for the token', async () => {
      const test = await publishTwoPageTest();
      const attemptToken = await startAttemptToken(context.app, test.code);
      context.clock.advanceBy(5_000);

      const response = await studentRequests(context.app, attemptToken).get('/api/attempt');
      expect(response.status).toBe(200);
      expect(response.body.attempt).toMatchObject({
        status: 'in_progress',
        studentName: STUDENT.studentName,
        serverTime: TEST_START_TIME + 5_000,
      });
    });

    it.each([
      ['no token', undefined],
      ['an unknown token', 'Bearer not-a-real-token'],
      ['a malformed header', 'Basic abc'],
    ])('refuses %s', async (_description, authorization) => {
      const attemptRequest = request(context.app).get('/api/attempt');
      if (authorization) attemptRequest.set('Authorization', authorization);
      const response = await attemptRequest;
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('attempt_not_found');
    });
  });

  describe('resuming on a new device', () => {
    it('counts the device change as an exit and logs the old device out', async () => {
      const test = await publishTwoPageTest({ allowedExits: 1 });
      const firstToken = await startAttemptToken(context.app, test.code);
      context.clock.advanceBy(60_000);

      const resumed = await startAttempt(context.app, test.code);
      expect(resumed.status).toBe(201);
      expect(resumed.body.attemptToken).not.toBe(firstToken);
      expect(resumed.body.attempt).toMatchObject({
        status: 'in_progress',
        exitsUsed: 1,
        startedAt: TEST_START_TIME,
        deadlineAt: TEST_START_TIME + THIRTY_MINUTES_MS,
      });

      const oldDevice = await studentRequests(context.app, firstToken).get('/api/attempt');
      expect(oldDevice.status).toBe(401);

      const newDevice = await studentRequests(context.app, resumed.body.attemptToken).get(
        '/api/attempt',
      );
      expect(newDevice.body.attempt.exitsUsed).toBe(1);
      expect(await readExits()).toEqual([{ reason: 'device_change' }]);
    });

    it('locks the attempt when no exits are allowed', async () => {
      const test = await publishTwoPageTest({ allowedExits: 0 });
      await startAttemptToken(context.app, test.code);

      const resumed = await startAttempt(context.app, test.code);
      expect(resumed.body.attempt.status).toBe('locked');

      const page = await studentRequests(context.app, resumed.body.attemptToken).get(
        '/api/attempt/pages/1',
      );
      expect(page.status).toBe(410);
    });

    it('shows a finished attempt again without counting an exit', async () => {
      const test = await publishTwoPageTest();
      const firstToken = await startAttemptToken(context.app, test.code);
      await studentRequests(context.app, firstToken).post('/api/attempt/finish');

      const resumed = await startAttempt(context.app, test.code);
      expect(resumed.status).toBe(201);
      expect(resumed.body.attempt).toMatchObject({
        status: 'submitted',
        finishReason: 'student',
        exitsUsed: 0,
      });
    });

    it('keeps attempts of different tests apart', async () => {
      const firstTest = await publishTwoPageTest();
      const secondTest = await publishTwoPageTest();
      await startAttemptToken(context.app, firstTest.code);

      const response = await startAttempt(context.app, secondTest.code);
      expect(response.body.attempt).toMatchObject({ status: 'in_progress', exitsUsed: 0 });
    });
  });

  describe('time limit', () => {
    it('keeps the attempt open until the deadline', async () => {
      const test = await publishTwoPageTest({ durationMinutes: 30 });
      const attemptToken = await startAttemptToken(context.app, test.code);
      context.clock.advanceBy(THIRTY_MINUTES_MS - 1);

      const response = await studentRequests(context.app, attemptToken).get('/api/attempt');
      expect(response.body.attempt.status).toBe('in_progress');
    });

    it('submits the attempt as time up once the deadline has passed', async () => {
      const test = await publishTwoPageTest({ durationMinutes: 30 });
      const attemptToken = await startAttemptToken(context.app, test.code);
      context.clock.advanceBy(THIRTY_MINUTES_MS + 10_000);
      const student = studentRequests(context.app, attemptToken);

      const response = await student.get('/api/attempt');
      expect(response.body.attempt).toMatchObject({
        status: 'submitted',
        finishReason: 'time_up',
      });

      const { rows } = await context.database.execute('SELECT finished_at FROM attempts');
      expect(rows[0]?.finished_at).toBe(TEST_START_TIME + THIRTY_MINUTES_MS);

      const page = await student.get('/api/attempt/pages/1');
      expect(page.status).toBe(410);
    });

    it('applies the time limit to page requests too', async () => {
      const test = await publishTwoPageTest({ durationMinutes: 30 });
      const attemptToken = await startAttemptToken(context.app, test.code);
      context.clock.advanceBy(THIRTY_MINUTES_MS);

      const page = await studentRequests(context.app, attemptToken).get('/api/attempt/pages/1');
      expect(page.status).toBe(410);
      expect(page.body.error.code).toBe('paper_closed');
    });

    it('shows the time-up screen when the student comes back after the deadline', async () => {
      const test = await publishTwoPageTest({ durationMinutes: 30 });
      await startAttemptToken(context.app, test.code);
      context.clock.advanceBy(THIRTY_MINUTES_MS + 1);

      const resumed = await startAttempt(context.app, test.code);
      expect(resumed.body.attempt).toMatchObject({
        status: 'submitted',
        finishReason: 'time_up',
        exitsUsed: 0,
      });
    });
  });

  describe('finishing', () => {
    it('submits the attempt and closes the paper for good', async () => {
      const test = await publishTwoPageTest();
      const attemptToken = await startAttemptToken(context.app, test.code);
      const student = studentRequests(context.app, attemptToken);
      context.clock.advanceBy(120_000);

      const finished = await student.post('/api/attempt/finish');
      expect(finished.status).toBe(200);
      expect(finished.body.attempt).toMatchObject({
        status: 'submitted',
        finishReason: 'student',
      });

      const { rows } = await context.database.execute('SELECT finished_at FROM attempts');
      expect(rows[0]?.finished_at).toBe(TEST_START_TIME + 120_000);

      const page = await student.get('/api/attempt/pages/1');
      expect(page.status).toBe(410);
      expect(page.body.error.code).toBe('paper_closed');
    });

    it('can be repeated safely', async () => {
      const test = await publishTwoPageTest();
      const student = studentRequests(context.app, await startAttemptToken(context.app, test.code));
      await student.post('/api/attempt/finish');
      context.clock.advanceBy(1_000);

      const again = await student.post('/api/attempt/finish');
      expect(again.status).toBe(200);
      expect(again.body.attempt.finishReason).toBe('student');
    });

    it('requires the token', async () => {
      const response = await request(context.app).post('/api/attempt/finish');
      expect(response.status).toBe(401);
    });
  });

  describe('pages', () => {
    it('returns a page image that browsers must not cache', async () => {
      const test = await publishTwoPageTest();
      const student = studentRequests(context.app, await startAttemptToken(context.app, test.code));

      const response = await student.get('/api/attempt/pages/2');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/webp');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(isWebpImage(new Uint8Array(response.body as Buffer))).toBe(true);
    });

    it('returns 404 for a page that does not exist', async () => {
      const test = await publishTwoPageTest();
      const student = studentRequests(context.app, await startAttemptToken(context.app, test.code));
      const response = await student.get('/api/attempt/pages/3');
      expect(response.status).toBe(404);
    });

    it.each(['0', 'abc', '1.5'])('rejects page number %j', async (pageNumber) => {
      const test = await publishTwoPageTest();
      const student = studentRequests(context.app, await startAttemptToken(context.app, test.code));
      const response = await student.get(`/api/attempt/pages/${pageNumber}`);
      expect(response.status).toBe(400);
    });

    it('requires the token', async () => {
      const response = await request(context.app).get('/api/attempt/pages/1');
      expect(response.status).toBe(401);
    });
  });

  describe('concurrent changes', () => {
    it('retries with the latest version when another request changed the attempt first', async () => {
      const test = await publishTwoPageTest();
      const attemptToken = await startAttemptToken(context.app, test.code);
      const staleAttempt = await findAttemptByTokenHash(context.database, sha256(attemptToken));
      if (!staleAttempt) throw new Error('The attempt was not stored.');

      await studentRequests(context.app, attemptToken).post('/api/attempt/finish');
      context.clock.advanceBy(60_000);

      const result = await changeAttempt(context.database, staleAttempt, (current) =>
        finishByStudent(current, context.clock.now()),
      );
      expect(result).toMatchObject({
        status: 'submitted',
        finishedAt: TEST_START_TIME,
        version: 1,
      });

      const { rows } = await context.database.execute('SELECT version FROM attempts');
      expect(rows[0]?.version).toBe(1);
    });
  });
});
