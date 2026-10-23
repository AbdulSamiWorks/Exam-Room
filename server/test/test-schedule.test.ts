import type { TestSummary } from '@exam-room/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  publishTest,
  startAttempt,
  startAttemptToken,
  STUDENT,
  studentRequests,
} from './support/exam-fixtures.js';
import { logInAsTeacher } from './support/teacher-agent.js';
import { createTestContext, TEST_START_TIME, type TestContext } from './support/test-context.js';

const MINUTE_MS = 60_000;
const SECOND_STUDENT = { studentName: 'Bilal Ahmed', rollNumber: '18' };

describe('opening and closing a test', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestContext();
  });
  afterEach(() => context.cleanUp());

  async function teacherAction(method: 'post' | 'put', path: string, body?: object) {
    const teacher = await logInAsTeacher(context.app);
    return teacher[method](path).send(body);
  }

  async function readPublicTest(testCode: string) {
    const response = await request(context.app).get(`/api/public/tests/${testCode}`);
    return response.body.test;
  }

  it('creates new tests closed, so no student can start yet', async () => {
    const test = await publishTest(context.app, { isOpen: false });
    expect(test).toMatchObject({ opensAt: null, closesAt: null, availability: 'not_open' });
    expect(await readPublicTest(test.code)).toMatchObject({ availability: 'not_open' });

    const response = await startAttempt(context.app, test.code);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('test_not_open');
  });

  it('lets students start after the teacher opens the test', async () => {
    const test = await publishTest(context.app, { isOpen: false });

    const opened = await teacherAction('post', `/api/tests/${test.id}/open`);
    expect(opened.status).toBe(200);
    expect(opened.body.test).toMatchObject({
      opensAt: TEST_START_TIME,
      closesAt: null,
      availability: 'open',
    });

    expect((await startAttempt(context.app, test.code)).status).toBe(201);
  });

  describe('after the teacher closes the test', () => {
    let test: TestSummary;
    let attemptToken: string;

    beforeEach(async () => {
      test = await publishTest(context.app);
      attemptToken = await startAttemptToken(context.app, test.code);
      context.clock.advanceBy(MINUTE_MS);
      const closed = await teacherAction('post', `/api/tests/${test.id}/close`);
      expect(closed.body.test).toMatchObject({
        closesAt: TEST_START_TIME + MINUTE_MS,
        availability: 'closed',
      });
    });

    it('stops new students from starting', async () => {
      const response = await startAttempt(context.app, test.code, SECOND_STUDENT);
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('test_closed');
      expect(await readPublicTest(test.code)).toMatchObject({ availability: 'closed' });
    });

    it('lets students who already started keep working and resume on another phone', async () => {
      const student = studentRequests(context.app, attemptToken);
      expect((await student.get('/api/attempt/pages/1')).status).toBe(200);

      const resumed = await startAttempt(context.app, test.code, STUDENT);
      expect(resumed.status).toBe(201);
      expect(resumed.body.attempt.status).toBe('in_progress');
    });

    it('can be opened again', async () => {
      const reopened = await teacherAction('post', `/api/tests/${test.id}/open`);
      expect(reopened.body.test).toMatchObject({ closesAt: null, availability: 'open' });
      expect((await startAttempt(context.app, test.code, SECOND_STUDENT)).status).toBe(201);
    });
  });

  it('opens and closes by itself at the scheduled times', async () => {
    const test = await publishTest(context.app, { isOpen: false });
    const opensAt = TEST_START_TIME + 10 * MINUTE_MS;
    const closesAt = opensAt + 15 * MINUTE_MS;

    const scheduled = await teacherAction('put', `/api/tests/${test.id}/schedule`, {
      opensAt,
      closesAt,
    });
    expect(scheduled.status).toBe(200);
    expect(scheduled.body.test).toMatchObject({ opensAt, closesAt, availability: 'scheduled' });
    expect((await startAttempt(context.app, test.code)).body.error.code).toBe('test_not_open');

    context.clock.advanceBy(10 * MINUTE_MS);
    expect((await startAttempt(context.app, test.code)).status).toBe(201);

    context.clock.advanceBy(15 * MINUTE_MS);
    const late = await startAttempt(context.app, test.code, SECOND_STUDENT);
    expect(late.body.error.code).toBe('test_closed');
  });

  it('cancels a scheduled opening when the teacher closes the test early', async () => {
    const test = await publishTest(context.app, { isOpen: false });
    await teacherAction('put', `/api/tests/${test.id}/schedule`, {
      opensAt: TEST_START_TIME + MINUTE_MS,
      closesAt: null,
    });

    const closed = await teacherAction('post', `/api/tests/${test.id}/close`);
    expect(closed.body.test).toMatchObject({
      opensAt: null,
      closesAt: null,
      availability: 'not_open',
    });
  });

  it('rejects a closing time that is not after the opening time', async () => {
    const test = await publishTest(context.app, { isOpen: false });
    const response = await teacherAction('put', `/api/tests/${test.id}/schedule`, {
      opensAt: TEST_START_TIME,
      closesAt: TEST_START_TIME,
    });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('The closing time must be after the opening time.');
  });

  it('requires a teacher login and an existing test', async () => {
    const test = await publishTest(context.app, { isOpen: false });
    expect((await request(context.app).post(`/api/tests/${test.id}/open`)).status).toBe(401);
    expect((await teacherAction('post', '/api/tests/999/close')).status).toBe(404);
  });
});
