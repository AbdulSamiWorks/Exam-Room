import type { AttemptResult } from '@exam-room/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  publishTest,
  startAttemptToken,
  STUDENT,
  studentRequests,
} from './support/exam-fixtures.js';
import { logInAsTeacher } from './support/teacher-agent.js';
import { createTestContext, TEST_START_TIME, type TestContext } from './support/test-context.js';

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const SECOND_STUDENT = { studentName: 'Bilal Ahmed', rollNumber: '18' };

describe('teacher results', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestContext();
  });
  afterEach(() => context.cleanUp());

  async function readResults(testId: number): Promise<AttemptResult[]> {
    const teacher = await logInAsTeacher(context.app);
    const response = await teacher.get(`/api/tests/${testId}/attempts`);
    expect(response.status).toBe(200);
    return response.body.attempts;
  }

  it('lists every student with exits and time away, including an exit still open', async () => {
    const test = await publishTest(context.app, { allowedExits: 2 });
    const first = studentRequests(context.app, await startAttemptToken(context.app, test.code));
    context.clock.advanceBy(10_000);
    await startAttemptToken(context.app, test.code, SECOND_STUDENT);

    await first.post('/api/attempt/exits').send({ clientExitId: 'exit-one-01', reason: 'hidden' });
    context.clock.advanceBy(4_000);
    await first
      .post('/api/attempt/return')
      .send({ clientExitId: 'exit-one-01', reason: 'hidden', awayMsClient: 4_000 });
    await first.post('/api/attempt/exits').send({ clientExitId: 'exit-two-02', reason: 'blur' });
    context.clock.advanceBy(3_000);

    const teacher = await logInAsTeacher(context.app);
    const response = await teacher.get(`/api/tests/${test.id}/attempts`);
    expect(response.body.serverTime).toBe(TEST_START_TIME + 17_000);
    expect(response.body.attempts).toEqual([
      expect.objectContaining({
        studentName: STUDENT.studentName,
        rollNumber: STUDENT.rollNumber,
        status: 'in_progress',
        startedAt: TEST_START_TIME,
        exitCount: 2,
        awayMs: 7_000,
        isAwayNow: true,
      }),
      expect.objectContaining({
        studentName: SECOND_STUDENT.studentName,
        startedAt: TEST_START_TIME + 10_000,
        exitCount: 0,
        awayMs: 0,
        isAwayNow: false,
      }),
    ]);
  });

  it('shows a student whose time ran out as submitted', async () => {
    const test = await publishTest(context.app, { durationMinutes: 30 });
    await startAttemptToken(context.app, test.code);
    context.clock.advanceBy(THIRTY_MINUTES_MS + 1);

    const [result] = await readResults(test.id);
    expect(result).toMatchObject({
      status: 'submitted',
      finishReason: 'time_up',
      finishedAt: TEST_START_TIME + THIRTY_MINUTES_MS,
    });
  });

  it('returns an empty list when nobody has started', async () => {
    const test = await publishTest(context.app);
    expect(await readResults(test.id)).toEqual([]);
  });

  it('returns 404 for an unknown test', async () => {
    const teacher = await logInAsTeacher(context.app);
    const response = await teacher.get('/api/tests/999/attempts');
    expect(response.status).toBe(404);
  });

  it('requires the teacher to be logged in', async () => {
    const test = await publishTest(context.app);
    const response = await request(context.app).get(`/api/tests/${test.id}/attempts`);
    expect(response.status).toBe(401);
  });
});

describe('unlocking', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestContext();
  });
  afterEach(() => context.cleanUp());

  async function lockedStudent(durationMinutes = 30) {
    const test = await publishTest(context.app, { allowedExits: 0, durationMinutes });
    const student = studentRequests(context.app, await startAttemptToken(context.app, test.code));
    await student
      .post('/api/attempt/exits')
      .send({ clientExitId: 'exit-one-01', reason: 'hidden' });
    const teacher = await logInAsTeacher(context.app);
    const [result] = (await teacher.get(`/api/tests/${test.id}/attempts`)).body
      .attempts as AttemptResult[];
    if (!result) throw new Error('The locked attempt is missing.');
    return { student, teacher, attemptId: result.id };
  }

  it('opens the paper again and the next exit locks it again', async () => {
    const { student, teacher, attemptId } = await lockedStudent();

    const unlocked = await teacher.post(`/api/attempts/${attemptId}/unlock`);
    expect(unlocked.status).toBe(200);
    expect(unlocked.body.attempt).toMatchObject({
      status: 'in_progress',
      finishedAt: null,
      exitCount: 1,
      forgivenExits: 1,
    });

    const studentView = await student.get('/api/attempt');
    expect(studentView.body.attempt).toMatchObject({ status: 'in_progress', exitsUsed: 0 });
    expect((await student.get('/api/attempt/pages/1')).status).toBe(200);

    const leftAgain = await student
      .post('/api/attempt/exits')
      .send({ clientExitId: 'exit-two-02', reason: 'blur' });
    expect(leftAgain.body.attempt.status).toBe('locked');
  });

  it('does not reopen an attempt whose time is over', async () => {
    const { teacher, attemptId } = await lockedStudent(30);
    context.clock.advanceBy(THIRTY_MINUTES_MS + 1);

    const response = await teacher.post(`/api/attempts/${attemptId}/unlock`);
    expect(response.body.attempt).toMatchObject({ status: 'submitted', finishReason: 'time_up' });
  });

  it('changes nothing for an attempt that is not locked', async () => {
    const test = await publishTest(context.app);
    const student = studentRequests(context.app, await startAttemptToken(context.app, test.code));
    await student.post('/api/attempt/finish');
    const teacher = await logInAsTeacher(context.app);
    const [result] = (await teacher.get(`/api/tests/${test.id}/attempts`)).body.attempts;

    const response = await teacher.post(`/api/attempts/${result.id}/unlock`);
    expect(response.body.attempt).toMatchObject({ status: 'submitted', forgivenExits: 0 });
  });

  it('returns 404 for an unknown attempt', async () => {
    const teacher = await logInAsTeacher(context.app);
    const response = await teacher.post('/api/attempts/999/unlock');
    expect(response.status).toBe(404);
  });

  it('requires the teacher to be logged in', async () => {
    const { attemptId } = await lockedStudent();
    const response = await request(context.app).post(`/api/attempts/${attemptId}/unlock`);
    expect(response.status).toBe(401);
  });
});
