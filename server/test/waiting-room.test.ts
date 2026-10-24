import type {
  AttemptResultListResponse,
  StudentAttempt,
  TestResponse,
  TestSummary,
} from '@exam-room/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  publishTest,
  startAttemptToken,
  STUDENT,
  studentRequests,
  type StudentIdentity,
} from './support/exam-fixtures.js';
import { logInAsTeacher } from './support/teacher-agent.js';
import { createTestContext, TEST_START_TIME, type TestContext } from './support/test-context.js';

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const SECOND_STUDENT: StudentIdentity = { studentName: 'Bilal Ahmed', rollNumber: '18' };

describe('waiting room', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestContext();
  });
  afterEach(() => context.cleanUp());

  async function readAttempt(attemptToken: string): Promise<StudentAttempt> {
    const response = await studentRequests(context.app, attemptToken).get('/api/attempt');
    return response.body.attempt;
  }

  async function startEveryone(test: TestSummary) {
    const teacher = await logInAsTeacher(context.app);
    return teacher.post(`/api/tests/${test.id}/attempts/start`);
  }

  it('keeps students waiting until the teacher starts everyone at the same time', async () => {
    const test = await publishTest(context.app, { waitingRoom: true });
    expect(test.waitingRoom).toBe(true);

    const firstToken = await startAttemptToken(context.app, test.code, STUDENT);
    context.clock.advanceBy(60_000);
    const secondToken = await startAttemptToken(context.app, test.code, SECOND_STUDENT);
    expect((await readAttempt(firstToken)).status).toBe('waiting');
    expect((await readAttempt(secondToken)).test.waitingRoom).toBe(true);

    context.clock.advanceBy(60_000);
    const started = await startEveryone(test);
    expect(started.status).toBe(200);
    const results = started.body as AttemptResultListResponse;
    const startedAt = TEST_START_TIME + 120_000;
    expect(results.attempts.map((attempt) => [attempt.status, attempt.startedAt])).toEqual([
      ['in_progress', startedAt],
      ['in_progress', startedAt],
    ]);

    const [first, second] = await Promise.all([readAttempt(firstToken), readAttempt(secondToken)]);
    expect(first).toMatchObject({ status: 'in_progress', startedAt });
    expect(first.deadlineAt).toBe(startedAt + THIRTY_MINUTES_MS);
    expect(second.deadlineAt).toBe(first.deadlineAt);
  });

  it('keeps the paper and answers closed while waiting and ignores exits', async () => {
    const test = await publishTest(context.app, { waitingRoom: true });
    const attemptToken = await startAttemptToken(context.app, test.code);
    const student = studentRequests(context.app, attemptToken);

    const page = await student.get('/api/attempt/pages/1');
    expect(page.status).toBe(409);
    expect(page.body.error.code).toBe('not_started');

    const answers = await student.post('/api/attempt/answers').send({
      answers: [{ questionId: 'q1', choice: 0, text: null, sequence: 1, answeredAt: 1 }],
    });
    expect(answers.status).toBe(409);

    const exit = await student
      .post('/api/attempt/exits')
      .send({ clientExitId: 'exit-while-waiting', reason: 'hidden' });
    expect(exit.body.attempt).toMatchObject({ status: 'waiting', exitsUsed: 0 });

    const finish = await student.post('/api/attempt/finish');
    expect(finish.body.attempt.status).toBe('waiting');
  });

  it('starts students who arrive later only when the teacher starts again', async () => {
    const test = await publishTest(context.app, { waitingRoom: true });
    const firstToken = await startAttemptToken(context.app, test.code, STUDENT);
    await startEveryone(test);

    context.clock.advanceBy(5 * 60_000);
    const lateToken = await startAttemptToken(context.app, test.code, SECOND_STUDENT);
    expect((await readAttempt(lateToken)).status).toBe('waiting');

    await startEveryone(test);
    const [first, late] = await Promise.all([readAttempt(firstToken), readAttempt(lateToken)]);
    expect(first.startedAt).toBe(TEST_START_TIME);
    expect(late).toMatchObject({ status: 'in_progress', startedAt: TEST_START_TIME + 5 * 60_000 });
  });

  it('submits waiting students when the teacher ends the exam', async () => {
    const test = await publishTest(context.app, { waitingRoom: true });
    const attemptToken = await startAttemptToken(context.app, test.code);
    const teacher = await logInAsTeacher(context.app);

    await teacher.post(`/api/tests/${test.id}/attempts/end`);

    expect(await readAttempt(attemptToken)).toMatchObject({
      status: 'submitted',
      finishReason: 'teacher',
    });
  });

  it('starts at once without the waiting room', async () => {
    const test = await publishTest(context.app);
    const attemptToken = await startAttemptToken(context.app, test.code);
    expect((await readAttempt(attemptToken)).status).toBe('in_progress');
  });

  it('can be switched only before anyone starts', async () => {
    const test = await publishTest(context.app);
    const teacher = await logInAsTeacher(context.app);

    const switchedOn = await teacher.patch(`/api/tests/${test.id}`).send({ waitingRoom: true });
    expect((switchedOn.body as TestResponse).test.waitingRoom).toBe(true);

    await startAttemptToken(context.app, test.code);
    const switchedOff = await teacher.patch(`/api/tests/${test.id}`).send({ waitingRoom: false });
    expect(switchedOff.status).toBe(409);
  });
});
