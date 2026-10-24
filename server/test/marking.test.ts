import type { MarkingResponse } from '@exam-room/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scoreAttempt, topScorerNames } from '../src/modules/marking/score-attempt.js';
import {
  classIdOfTest,
  logInAsStudent,
  startAttemptToken,
  studentRequests,
} from './support/exam-fixtures.js';
import { publishTypedTest, SAMPLE_ANSWER_KEY, SAMPLE_PAPER } from './support/paper-fixtures.js';
import { createTestContext, TEST_START_TIME, type TestContext } from './support/test-context.js';

const PAPER = {
  ...SAMPLE_PAPER,
  sections: SAMPLE_PAPER.sections.map((section) => ({
    ...section,
    questions: section.questions.map((question) => ({ ...question, imageNumber: null })),
  })),
};
const SECOND_STUDENT = { studentName: 'Bilal Ahmed', rollNumber: '18' };

describe('scoreAttempt', () => {
  const answers = new Map([
    ['q1', { questionId: 'q1', choice: 1, text: null, sequence: 1 }],
    ['q2', { questionId: 'q2', choice: 0, text: null, sequence: 1 }],
    ['q3', { questionId: 'q3', choice: null, text: 'Law', sequence: 1 }],
  ]);

  it('marks MCQs from the key and adds the teacher marks for written answers', () => {
    expect(scoreAttempt(PAPER, SAMPLE_ANSWER_KEY, answers, new Map())).toEqual({
      mcqMarks: 1,
      writtenMarks: 0,
      totalMarks: 1,
      correctCount: 1,
      mcqCount: 2,
      markedWrittenCount: 0,
      writtenCount: 1,
    });
    const marks = new Map([['q3', { marks: 2.5, comment: 'Good' }]]);
    expect(scoreAttempt(PAPER, SAMPLE_ANSWER_KEY, answers, marks)).toMatchObject({
      writtenMarks: 2.5,
      totalMarks: 3.5,
      markedWrittenCount: 1,
    });
  });

  it('lets the teacher overrule an MCQ mark', () => {
    const marks = new Map([['q2', { marks: 1, comment: 'Also right' }]]);
    expect(scoreAttempt(PAPER, SAMPLE_ANSWER_KEY, answers, marks).mcqMarks).toBe(2);
  });

  it('names every top scorer, and nobody when all have zero', () => {
    expect(
      topScorerNames([
        { studentName: 'Ayesha', totalMarks: 4 },
        { studentName: 'Bilal', totalMarks: 4 },
        { studentName: 'Sana', totalMarks: 3 },
        { studentName: 'Hamza', totalMarks: null },
      ]),
    ).toEqual(['Ayesha', 'Bilal']);
    expect(topScorerNames([{ studentName: 'Ayesha', totalMarks: 0 }])).toEqual([]);
  });
});

describe('marking and releasing results', () => {
  let context: TestContext;
  let test: Awaited<ReturnType<typeof publishTypedTest>>['test'];
  let teacher: Awaited<ReturnType<typeof publishTypedTest>>['teacher'];

  beforeEach(async () => {
    context = await createTestContext();
    ({ test, teacher } = await publishTypedTest(context.app, { paper: PAPER }));
    const ayesha = studentRequests(context.app, await startAttemptToken(context.app, test.code));
    await ayesha.post('/api/attempt/answers').send({
      answers: [
        { questionId: 'q1', choice: 1, text: null, sequence: 1, answeredAt: TEST_START_TIME },
        { questionId: 'q3', choice: null, text: 'Law', sequence: 2, answeredAt: TEST_START_TIME },
      ],
    });
    await ayesha.post('/api/attempt/finish');
    const bilal = studentRequests(
      context.app,
      await startAttemptToken(context.app, test.code, SECOND_STUDENT),
    );
    await bilal.post('/api/attempt/answers').send({
      answers: [
        { questionId: 'q1', choice: 0, text: null, sequence: 1, answeredAt: TEST_START_TIME },
      ],
    });
    await bilal.post('/api/attempt/finish');
  });
  afterEach(() => context.cleanUp());

  async function marking(): Promise<MarkingResponse> {
    return (await teacher.get(`/api/tests/${test.id}/marking`)).body;
  }

  it('shows every answer with the marks so far', async () => {
    const { attempts, maxMarks } = await marking();
    expect(maxMarks).toBe(5);
    expect(attempts.map((attempt) => [attempt.studentName, attempt.score.totalMarks])).toEqual([
      ['Ayesha Khan', 1],
      ['Bilal Ahmed', 0],
    ]);
    expect(attempts[0]?.answers).toHaveLength(2);
  });

  it('saves written marks and comments and checks their range', async () => {
    const [ayesha] = (await marking()).attempts;
    const saved = await teacher.put(`/api/attempts/${ayesha?.attemptId}/marks`).send({
      questionMarks: { q3: { marks: 2.5, comment: 'Name the law.' } },
      comment: 'Well done.',
    });
    expect(saved.body.attempt.score).toMatchObject({ totalMarks: 3.5, markedWrittenCount: 1 });

    const tooMany = await teacher
      .put(`/api/attempts/${ayesha?.attemptId}/marks`)
      .send({ questionMarks: { q3: { marks: 4, comment: '' } }, comment: '' });
    expect(tooMany.status).toBe(400);
  });

  it('re-marks every student when the answer key changes', async () => {
    await teacher
      .put(`/api/tests/${test.id}/answer-key`)
      .send({ answerKey: { q1: { option: 0 } } });
    const { attempts } = await marking();
    expect(attempts.map((attempt) => attempt.score.totalMarks)).toEqual([0, 1]);
  });

  it('shows the multiple choice result right after finishing, without written marks', async () => {
    const student = await logInAsStudent(context.app, classIdOfTest(context.app, test.code));
    const [ayesha] = (await marking()).attempts;
    await teacher.put(`/api/attempts/${ayesha?.attemptId}/marks`).send({
      questionMarks: { q3: { marks: 3, comment: 'Perfect.' } },
      comment: 'Great work.',
    });

    const result = await student.get(`/api/student/results/${test.code}`);

    expect(result.body).toMatchObject({
      isFinal: false,
      totalMarks: 1,
      maxMarks: 2,
      comment: '',
      topScorers: null,
      releasedAt: null,
    });
    expect(
      result.body.questions.map((question: { marks: number | null }) => question.marks),
    ).toEqual([1, 0, null]);
    expect(result.body.questions[1]).toMatchObject({ chosenOption: null, correctOption: 2 });
    const home = await student.get('/api/student/home');
    expect(home.body.tests[0]).toMatchObject({ hasMcqResult: true, releasedMarks: null });
  });

  it('keeps every result hidden until release when the test asks for it', async () => {
    await teacher.patch(`/api/tests/${test.id}`).send({ instantMcqResult: false });
    const student = await logInAsStudent(context.app, classIdOfTest(context.app, test.code));
    expect((await student.get(`/api/student/results/${test.code}`)).status).toBe(403);
    const home = await student.get('/api/student/home');
    expect(home.body.tests[0]).toMatchObject({ hasMcqResult: false });
  });

  it('shows students their full result after release, with the chosen details', async () => {
    await teacher.patch(`/api/tests/${test.id}`).send({ instantMcqResult: false });
    const student = await logInAsStudent(context.app, classIdOfTest(context.app, test.code));
    const before = await student.get(`/api/student/results/${test.code}`);
    expect(before.status).toBe(403);

    const [ayesha] = (await marking()).attempts;
    await teacher.put(`/api/attempts/${ayesha?.attemptId}/marks`).send({
      questionMarks: { q3: { marks: 3, comment: 'Perfect.' } },
      comment: 'Great work.',
    });
    const release = await teacher
      .put(`/api/tests/${test.id}/release`)
      .send({ showCorrectAnswers: false, showComments: true, showTopScorer: true });
    expect(release.body.releasedAt).toBe(TEST_START_TIME);

    const result = await student.get(`/api/student/results/${test.code}`);
    expect(result.body).toMatchObject({
      isFinal: true,
      totalMarks: 4,
      maxMarks: 5,
      comment: 'Great work.',
      topScorers: ['Ayesha Khan'],
    });
    expect(result.body.questions[0]).toEqual({
      questionId: 'q1',
      marks: 1,
      chosenOption: 1,
      typedAnswer: null,
      correctOption: null,
      comment: '',
    });
    const home = await student.get('/api/student/home');
    expect(home.body.tests[0]).toMatchObject({ releasedMarks: 4, maxMarks: 5 });

    await teacher.delete(`/api/tests/${test.id}/release`);
    expect((await student.get(`/api/student/results/${test.code}`)).status).toBe(403);
  });
});
