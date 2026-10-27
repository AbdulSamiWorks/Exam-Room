import type { AnswerChange } from '@exam-room/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  classIdOfTest,
  logInAsStudent,
  startAttemptToken,
  studentRequests,
} from './support/exam-fixtures.js';
import { GRAMMAR_ANSWER_KEY, GRAMMAR_PAPER, publishTypedTest } from './support/paper-fixtures.js';
import { createTestContext, TEST_START_TIME, type TestContext } from './support/test-context.js';

function typed(questionId: string, text: string, sequence = 1): AnswerChange {
  return { questionId, choice: null, text, sequence, answeredAt: TEST_START_TIME };
}

describe('a grammar paper with parts and blanks', () => {
  let context: TestContext;
  let test: Awaited<ReturnType<typeof publishTypedTest>>['test'];
  let teacher: Awaited<ReturnType<typeof publishTypedTest>>['teacher'];
  let student: ReturnType<typeof studentRequests>;

  beforeEach(async () => {
    context = await createTestContext();
    ({ test, teacher } = await publishTypedTest(context.app, {
      paper: GRAMMAR_PAPER,
      answerKey: GRAMMAR_ANSWER_KEY,
      writtenAnswers: 'typed',
    }));
    student = studentRequests(context.app, await startAttemptToken(context.app, test.code));
    const saved = await student.post('/api/attempt/answers').send({
      answers: [
        { questionId: 'q1', choice: 1, text: null, sequence: 1, answeredAt: TEST_START_TIME },
        typed('q2a', "The shopkeeper doesn't sell fresh fruit"),
        typed('q2b', 'I have not lock the door.'),
        typed('q3.1', ' Lives '),
        typed('q3.2', 'studies'),
        typed('q4', 'My school is big and green.'),
      ],
    });
    expect(saved.body.savedCount).toBe(6);
  });
  afterEach(() => context.cleanUp());

  it('counts the paper in questions and in answers', async () => {
    expect(test).toMatchObject({ questionCount: 4, answerCount: 5, maxMarks: 9 });
    const results = await teacher.get(`/api/tests/${test.id}/attempts`);
    expect(results.body.attempts[0]).toMatchObject({ answeredCount: 5 });
  });

  it('refuses boxes that are not on the paper', async () => {
    const refused = await student
      .post('/api/attempt/answers')
      .send({ answers: [typed('q3.3', 'x'), typed('q2c', 'y')] });
    expect(refused.status).toBe(400);
  });

  it('checks parts and blanks exactly and shows the right answers at once', async () => {
    await student.post('/api/attempt/finish');
    const own = await logInAsStudent(context.app, classIdOfTest(context.app, test.code));
    const result = await own.get(`/api/student/results/${test.code}`);

    expect(result.body).toMatchObject({ isFinal: false, totalMarks: 2.5, maxMarks: 4 });
    const units = result.body.units as Array<Record<string, unknown>>;
    expect(units.map((unit) => [unit.unitId, unit.marks, unit.isCorrect])).toEqual([
      ['q1', 1, true],
      ['q2a', 1, true],
      ['q2b', 0, false],
      ['q3', 0.5, false],
      ['q4', null, null],
    ]);
    expect(units[2]).toMatchObject({
      typedAnswer: 'I have not lock the door.',
      correctAnswers: ['I have not locked the door.'],
    });
    expect(units[3]).toMatchObject({
      blankAnswers: [' Lives ', 'studies'],
      blankResults: [true, false],
      correctAnswers: ['lives', 'is studying'],
    });
    expect(units[4]).toMatchObject({
      typedAnswer: 'My school is big and green.',
      modelAnswer: null,
    });
  });

  it('lets the teacher overrule an exact mark and mark the written part', async () => {
    await student.post('/api/attempt/finish');
    const [attempt] = (await teacher.get(`/api/tests/${test.id}/marking`)).body.attempts;
    expect(attempt.score).toEqual({
      autoMarks: 2.5,
      writtenMarks: 0,
      totalMarks: 2.5,
      correctCount: 2,
      autoCount: 4,
      markedWrittenCount: 0,
      writtenCount: 1,
    });

    const saved = await teacher.put(`/api/attempts/${attempt.attemptId}/marks`).send({
      questionMarks: {
        q2b: { marks: 1, comment: 'Small spelling slip.' },
        q4: { marks: 4.5, comment: '' },
      },
      comment: '',
    });
    expect(saved.body.attempt.score).toMatchObject({
      autoMarks: 3.5,
      writtenMarks: 4.5,
      totalMarks: 8,
    });

    const tooMany = await teacher.put(`/api/attempts/${attempt.attemptId}/marks`).send({
      questionMarks: { q2a: { marks: 2, comment: '' } },
      comment: '',
    });
    expect(tooMany.body.error.message).toBe('Marks must be between 0 and 1 for question 2(a).');
  });
});
