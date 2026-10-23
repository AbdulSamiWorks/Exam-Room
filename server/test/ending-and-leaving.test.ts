import type { AttemptResult } from '@exam-room/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  publishTest,
  startAttempt,
  startAttemptToken,
  studentRequests,
} from './support/exam-fixtures.js';
import { logInAsTeacher } from './support/teacher-agent.js';
import { createTestContext, TEST_START_TIME, type TestContext } from './support/test-context.js';

const MINUTE_MS = 60_000;
const SECOND_STUDENT = { studentName: 'Bilal Ahmed', rollNumber: '18' };
const THIRD_STUDENT = { studentName: 'Sana Iqbal', rollNumber: '19' };

describe('ending the exam and the leave rule', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestContext();
  });
  afterEach(() => context.cleanUp());

  async function readResults(testId: number): Promise<AttemptResult[]> {
    const teacher = await logInAsTeacher(context.app);
    return (await teacher.get(`/api/tests/${testId}/attempts`)).body.attempts;
  }

  function leave(student: ReturnType<typeof studentRequests>, clientExitId: string) {
    return student.post('/api/attempt/exits').send({ clientExitId, reason: 'hidden' });
  }

  describe('ending for one student', () => {
    it('submits only that attempt and closes its paper', async () => {
      const test = await publishTest(context.app);
      const first = studentRequests(context.app, await startAttemptToken(context.app, test.code));
      const second = studentRequests(
        context.app,
        await startAttemptToken(context.app, test.code, SECOND_STUDENT),
      );
      const [firstResult] = await readResults(test.id);
      context.clock.advanceBy(MINUTE_MS);

      const teacher = await logInAsTeacher(context.app);
      const ended = await teacher.post(`/api/attempts/${firstResult?.id}/end`);
      expect(ended.status).toBe(200);
      expect(ended.body.attempt).toMatchObject({
        status: 'submitted',
        finishReason: 'teacher',
        finishedAt: TEST_START_TIME + MINUTE_MS,
      });

      expect((await first.get('/api/attempt/pages/1')).status).toBe(410);
      expect((await first.get('/api/attempt')).body.attempt.finishReason).toBe('teacher');
      expect((await second.get('/api/attempt/pages/1')).status).toBe(200);
    });

    it('requires a teacher login and an existing attempt', async () => {
      expect((await request(context.app).post('/api/attempts/1/end')).status).toBe(401);
      const teacher = await logInAsTeacher(context.app);
      expect((await teacher.post('/api/attempts/999/end')).status).toBe(404);
    });
  });

  describe('ending for everyone', () => {
    it('submits every running attempt, keeps locked ones locked and closes the test', async () => {
      const test = await publishTest(context.app, { allowedExits: 0 });
      await startAttemptToken(context.app, test.code);
      const lockedStudent = studentRequests(
        context.app,
        await startAttemptToken(context.app, test.code, SECOND_STUDENT),
      );
      await leave(lockedStudent, 'exit-one-01');
      context.clock.advanceBy(MINUTE_MS);

      const teacher = await logInAsTeacher(context.app);
      const ended = await teacher.post(`/api/tests/${test.id}/attempts/end`);
      expect(ended.status).toBe(200);
      expect(
        ended.body.attempts.map((attempt: AttemptResult) => [attempt.status, attempt.finishReason]),
      ).toEqual([
        ['submitted', 'teacher'],
        ['locked', null],
      ]);

      const testAfter = await teacher.get(`/api/tests/${test.id}`);
      expect(testAfter.body.test.availability).toBe('closed');
      const late = await startAttempt(context.app, test.code, THIRD_STUDENT);
      expect(late.body.error.code).toBe('test_closed');
    });

    it('records students whose time already ran out as time up', async () => {
      const test = await publishTest(context.app, { durationMinutes: 1 });
      await startAttemptToken(context.app, test.code);
      context.clock.advanceBy(2 * MINUTE_MS);

      const teacher = await logInAsTeacher(context.app);
      const ended = await teacher.post(`/api/tests/${test.id}/attempts/end`);
      expect(ended.body.attempts[0]).toMatchObject({
        status: 'submitted',
        finishReason: 'time_up',
        finishedAt: TEST_START_TIME + MINUTE_MS,
      });
    });
  });

  describe('leave rule "finish"', () => {
    it('submits the test as left when the student leaves too often, with no unlock', async () => {
      const test = await publishTest(context.app, { allowedExits: 0, leaveRule: 'finish' });
      expect(test.leaveRule).toBe('finish');
      const student = studentRequests(context.app, await startAttemptToken(context.app, test.code));

      const exit = await leave(student, 'exit-one-01');
      expect(exit.body.attempt).toMatchObject({ status: 'submitted', finishReason: 'left_test' });
      expect((await student.get('/api/attempt/pages/1')).status).toBe(410);

      const [result] = await readResults(test.id);
      const teacher = await logInAsTeacher(context.app);
      const unlock = await teacher.post(`/api/attempts/${result?.id}/unlock`);
      expect(unlock.body.attempt).toMatchObject({ status: 'submitted', finishReason: 'left_test' });
    });

    it('rejects an unknown leave rule', async () => {
      await expect(
        publishTest(context.app, { leaveRule: 'explode' as 'lock', isOpen: false }),
      ).rejects.toThrow('Test creation failed: 400');
    });
  });

  it('shows the exit history of every student', async () => {
    const test = await publishTest(context.app, { allowedExits: 2 });
    const student = studentRequests(context.app, await startAttemptToken(context.app, test.code));
    context.clock.advanceBy(10_000);
    await leave(student, 'exit-one-01');
    context.clock.advanceBy(4_000);
    await student
      .post('/api/attempt/return')
      .send({ clientExitId: 'exit-one-01', reason: 'hidden', awayMsClient: 4_000 });
    context.clock.advanceBy(6_000);
    await leave(student, 'exit-two-02');
    context.clock.advanceBy(3_000);

    const [result] = await readResults(test.id);
    expect(result?.exits).toEqual([
      {
        reason: 'hidden',
        leftAt: TEST_START_TIME + 10_000,
        returnedAt: TEST_START_TIME + 14_000,
        awayMs: 4_000,
      },
      { reason: 'hidden', leftAt: TEST_START_TIME + 20_000, returnedAt: null, awayMs: 3_000 },
    ]);
  });
});
