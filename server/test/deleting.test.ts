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

describe('deleting', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestContext();
  });
  afterEach(() => context.cleanUp());

  async function countRows(table: 'tests' | 'test_pages' | 'attempts' | 'exits') {
    const { rows } = await context.database.execute(`SELECT COUNT(*) AS total FROM ${table}`);
    return Number(rows[0]?.total);
  }

  async function startWithOneExit(testCode: string) {
    const student = studentRequests(context.app, await startAttemptToken(context.app, testCode));
    await student
      .post('/api/attempt/exits')
      .send({ clientExitId: 'exit-one-01', reason: 'hidden' });
    return student;
  }

  describe('a test', () => {
    it('removes the paper, every student attempt and every exit', async () => {
      const test = await publishTest(context.app);
      const keptTest = await publishTest(context.app, { title: 'Kept' });
      const student = await startWithOneExit(test.code);
      await startAttemptToken(context.app, keptTest.code);

      const teacher = await logInAsTeacher(context.app);
      expect((await teacher.delete(`/api/tests/${test.id}`)).status).toBe(204);

      expect(await countRows('tests')).toBe(1);
      expect(await countRows('test_pages')).toBe(1);
      expect(await countRows('attempts')).toBe(1);
      expect(await countRows('exits')).toBe(0);
      expect((await teacher.get(`/api/tests/${test.id}`)).status).toBe(404);
      expect((await request(context.app).get(`/api/public/tests/${test.code}`)).status).toBe(404);
      expect((await student.get('/api/attempt')).status).toBe(401);
    });

    it('requires a teacher login and an existing test', async () => {
      const test = await publishTest(context.app);
      expect((await request(context.app).delete(`/api/tests/${test.id}`)).status).toBe(401);

      const teacher = await logInAsTeacher(context.app);
      expect((await teacher.delete('/api/tests/999')).status).toBe(404);
    });
  });

  describe('one student attempt', () => {
    it('removes the attempt and its exits so the roll number can start again', async () => {
      const test = await publishTest(context.app);
      const removedStudent = await startWithOneExit(test.code);
      await startAttemptToken(context.app, test.code, SECOND_STUDENT);
      const teacher = await logInAsTeacher(context.app);
      const results = await teacher.get(`/api/tests/${test.id}/attempts`);
      const removedAttemptId = results.body.attempts[0].id;

      context.clock.advanceBy(MINUTE_MS);
      expect((await teacher.delete(`/api/attempts/${removedAttemptId}`)).status).toBe(204);

      expect(await countRows('exits')).toBe(0);
      const remaining = await teacher.get(`/api/tests/${test.id}/attempts`);
      expect(remaining.body.attempts).toEqual([
        expect.objectContaining({ rollNumber: SECOND_STUDENT.rollNumber }),
      ]);
      expect((await removedStudent.get('/api/attempt')).status).toBe(401);

      const startedAgain = await startAttempt(context.app, test.code, STUDENT);
      expect(startedAgain.status).toBe(201);
      expect(startedAgain.body.attempt).toMatchObject({
        startedAt: TEST_START_TIME + MINUTE_MS,
        exitsUsed: 0,
      });
    });

    it('requires a teacher login and an existing attempt', async () => {
      expect((await request(context.app).delete('/api/attempts/1')).status).toBe(401);

      const teacher = await logInAsTeacher(context.app);
      expect((await teacher.delete('/api/attempts/999')).status).toBe(404);
    });
  });
});
