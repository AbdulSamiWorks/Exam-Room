import type { AnswerChange } from '@exam-room/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startAttemptToken, studentRequests } from './support/exam-fixtures.js';
import { publishTypedTest, SAMPLE_PAPER } from './support/paper-fixtures.js';
import { logInAsTeacher } from './support/teacher-agent.js';
import { createTestContext, TEST_START_TIME, type TestContext } from './support/test-context.js';

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const DEADLINE = TEST_START_TIME + THIRTY_MINUTES_MS;
const PAPER_WITHOUT_PICTURE = {
  ...SAMPLE_PAPER,
  sections: SAMPLE_PAPER.sections.map((section) => ({
    ...section,
    questions: section.questions.map((question) => ({ ...question, imageNumber: null })),
  })),
};

function answer(overrides: Partial<AnswerChange>): AnswerChange {
  return {
    questionId: 'q1',
    choice: 1,
    text: null,
    sequence: 1,
    answeredAt: TEST_START_TIME + 1000,
    ...overrides,
  };
}

describe('answers', () => {
  let context: TestContext;
  let student: ReturnType<typeof studentRequests>;
  let testId: number;

  beforeEach(async () => {
    context = await createTestContext();
    const { test } = await publishTypedTest(context.app, { paper: PAPER_WITHOUT_PICTURE });
    testId = test.id;
    student = studentRequests(context.app, await startAttemptToken(context.app, test.code));
  });
  afterEach(() => context.cleanUp());

  function send(...answers: AnswerChange[]) {
    return student.post('/api/attempt/answers').send({ answers });
  }

  async function storedAnswers() {
    return (await student.get('/api/attempt/answers')).body.answers;
  }

  it('saves choices and typed answers', async () => {
    const response = await send(
      answer({}),
      answer({ questionId: 'q3', choice: null, text: 'Objects keep moving.' }),
    );
    expect(response.body).toEqual({ savedCount: 2, tooLateCount: 0, serverTime: TEST_START_TIME });
    expect(await storedAnswers()).toEqual([
      { questionId: 'q1', choice: 1, text: null, sequence: 1 },
      { questionId: 'q3', choice: null, text: 'Objects keep moving.', sequence: 1 },
    ]);
  });

  it('keeps the newest answer when batches repeat or arrive out of order', async () => {
    await send(answer({ choice: 2, sequence: 5 }));
    await send(answer({ choice: 0, sequence: 3 }));
    await send(answer({ choice: 2, sequence: 5 }));
    expect(await storedAnswers()).toEqual([
      { questionId: 'q1', choice: 2, text: null, sequence: 5 },
    ]);

    await send(answer({ choice: null, sequence: 6 }));
    expect((await storedAnswers())[0]).toMatchObject({ choice: null, sequence: 6 });
  });

  it('refuses answers that do not fit the paper', async () => {
    expect((await send(answer({ questionId: 'q9' }))).status).toBe(400);
    expect((await send(answer({ choice: 3, questionId: 'q2' }))).status).toBe(400);
    expect((await send(answer({ questionId: 'q1', choice: null, text: 'x' }))).status).toBe(400);
  });

  it('accepts answers made before the time ran out for 10 more minutes', async () => {
    context.clock.advanceBy(THIRTY_MINUTES_MS + 9 * 60 * 1000);
    const late = await send(
      answer({ answeredAt: DEADLINE - 5000, sequence: 2 }),
      answer({ questionId: 'q2', answeredAt: DEADLINE + 60_000, choice: 0 }),
    );
    expect(late.body).toMatchObject({ savedCount: 1, tooLateCount: 1 });

    context.clock.advanceBy(2 * 60 * 1000);
    const tooLate = await send(answer({ answeredAt: DEADLINE - 1000, sequence: 3 }));
    expect(tooLate.body).toMatchObject({ savedCount: 0, tooLateCount: 1 });

    const teacher = await logInAsTeacher(context.app);
    const results = await teacher.get(`/api/tests/${testId}/attempts`);
    expect(results.body.attempts[0]).toMatchObject({ status: 'submitted', answeredCount: 1 });
  });

  it('counts answers made before the student tapped Finish', async () => {
    context.clock.advanceBy(60_000);
    await student.post('/api/attempt/finish');
    const response = await send(answer({ answeredAt: TEST_START_TIME + 30_000 }));
    expect(response.body.savedCount).toBe(1);
    expect((await student.get('/api/attempt/answers')).status).toBe(410);
  });

  it('needs the attempt token', async () => {
    const response = await studentRequests(context.app, 'not-a-token')
      .post('/api/attempt/answers')
      .send({ answers: [answer({})] });
    expect(response.status).toBe(401);
  });
});
