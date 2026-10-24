import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClassWithSubject } from './support/catalog-fixtures.js';
import { publishTest, startAttemptToken, studentRequests } from './support/exam-fixtures.js';
import { createBlankPageImage, isWebpImage } from './support/page-image-fixtures.js';
import { publishTypedTest, SAMPLE_ANSWER_KEY, SAMPLE_PAPER } from './support/paper-fixtures.js';
import { logInAsTeacher } from './support/teacher-agent.js';
import { createTestContext, type TestContext } from './support/test-context.js';

describe('typed papers', () => {
  let context: TestContext;
  let picture: Buffer;

  beforeAll(async () => {
    picture = await createBlankPageImage(1600, 900);
  });
  beforeEach(async () => {
    context = await createTestContext();
  });
  afterEach(() => context.cleanUp());

  it('creates a typed test with its questions, marks and pictures', async () => {
    const { response, test, teacher } = await publishTypedTest(context.app, {
      images: [picture],
    });

    expect(response.status).toBe(201);
    expect(test).toMatchObject({
      paperKind: 'typed',
      pageCount: 0,
      questionCount: 3,
      maxMarks: 5,
      writtenAnswers: 'typed',
    });
    const stored = await teacher.get(`/api/tests/${test.id}/paper`);
    expect(stored.body).toEqual({
      paper: SAMPLE_PAPER,
      answerKey: SAMPLE_ANSWER_KEY,
      imageCount: 1,
    });
    const image = await teacher.get(`/api/tests/${test.id}/paper-images/1`);
    expect(isWebpImage(image.body)).toBe(true);
  });

  it('accepts a typed test that sends every setting the form has', async () => {
    const teacher = await logInAsTeacher(context.app);
    const subject = await createClassWithSubject(teacher);
    const response = await teacher
      .post('/api/tests')
      .field('paperKind', 'typed')
      .field('subjectId', String(subject.id))
      .field('kind', 'quiz')
      .field('chapterIds', '')
      .field('title', 'Every setting')
      .field('durationMinutes', '45')
      .field('allowedExits', '1')
      .field('leaveRule', 'lock')
      .field('writtenAnswers', 'typed_and_photos')
      .field('bountyNote', 'A book')
      .field('bountyPoints', '5')
      .field('waitingRoom', 'true')
      .field('instantMcqResult', 'true')
      .field('shuffleQuestions', 'true')
      .field('maxMarks', '10')
      .field('paper', JSON.stringify({ ...SAMPLE_PAPER, sections: [SAMPLE_PAPER.sections[1]] }))
      .field('answerKey', '{}');

    expect(response.status).toBe(201);
    expect(response.body.test).toMatchObject({
      waitingRoom: true,
      instantMcqResult: true,
      shuffleQuestions: true,
    });
  });

  it('gives each student a mixing number when the test mixes the question order', async () => {
    const { test, teacher } = await publishTypedTest(context.app, {
      images: [picture],
      isOpen: false,
    });
    await teacher.patch(`/api/tests/${test.id}`).send({ shuffleQuestions: true });
    await teacher.post(`/api/tests/${test.id}/open`);
    const student = studentRequests(context.app, await startAttemptToken(context.app, test.code));

    const paper = await student.get('/api/attempt/paper');

    expect(paper.body.paper).toEqual(SAMPLE_PAPER);
    expect(paper.body.shuffleSeed).toEqual(expect.any(Number));
  });

  it('shows students the paper without the answers while the test is running', async () => {
    const { test } = await publishTypedTest(context.app, { images: [picture] });
    const student = studentRequests(context.app, await startAttemptToken(context.app, test.code));

    const paper = await student.get('/api/attempt/paper');
    expect(paper.status).toBe(200);
    expect(paper.body).toEqual({ paper: SAMPLE_PAPER, shuffleSeed: null });
    expect(JSON.stringify(paper.body)).not.toContain('stays at rest');
    expect((await student.get('/api/attempt/paper-images/1')).status).toBe(200);

    await student.post('/api/attempt/finish');
    expect((await student.get('/api/attempt/paper')).status).toBe(410);
    expect((await student.get('/api/attempt/paper-images/1')).status).toBe(410);
  });

  it.each([
    ['no questions', { paper: { instructions: '', sections: [] } }, 'invalid_input'],
    ['an answer that is not an option', { answerKey: { q2: { option: 4 } } }, 'invalid_answer_key'],
    ['a picture that was not uploaded', {}, 'paper_image_missing'],
  ])('refuses a paper with %s', async (_description, options, errorCode) => {
    const { response } = await publishTypedTest(context.app, options);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(errorCode);
  });

  it('changes the answer key at any time, but the paper only before anyone starts', async () => {
    const { test, teacher } = await publishTypedTest(context.app, { images: [picture] });
    await startAttemptToken(context.app, test.code);

    const answerKey = { q1: { option: 0 } };
    const savedKey = await teacher.put(`/api/tests/${test.id}/answer-key`).send({ answerKey });
    expect(savedKey.status).toBe(200);
    expect(savedKey.body.answerKey).toEqual(answerKey);

    const replaced = await teacher
      .put(`/api/tests/${test.id}/paper`)
      .field('paper', JSON.stringify(SAMPLE_PAPER));
    expect(replaced.status).toBe(409);
  });

  it('adds an answer sheet to a PDF test', async () => {
    const test = await publishTest(context.app, { isOpen: false });
    const teacher = await logInAsTeacher(context.app);
    const answerSheet = {
      instructions: '',
      sections: [
        {
          title: 'Answer sheet',
          instructions: '',
          questions: [
            {
              id: 'q1',
              kind: 'mcq',
              text: 'Question 1',
              marks: 2,
              options: ['A', 'B'],
              imageNumber: null,
            },
          ],
        },
      ],
    };

    const response = await teacher
      .put(`/api/tests/${test.id}/paper`)
      .field('paper', JSON.stringify(answerSheet))
      .field('answerKey', JSON.stringify({ q1: { option: 1 } }));
    expect(response.status).toBe(200);
    expect(response.body.test).toMatchObject({ paperKind: 'pages', questionCount: 1, maxMarks: 2 });
  });

  it('deletes the pictures with the test', async () => {
    const { test, teacher } = await publishTypedTest(context.app, { images: [picture] });
    await teacher.delete(`/api/tests/${test.id}`);
    const { rows } = await context.database.execute('SELECT COUNT(*) AS total FROM paper_images');
    expect(rows[0]?.total).toBe(0);
  });
});
