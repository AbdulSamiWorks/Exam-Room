import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createChapter } from './support/catalog-fixtures.js';
import {
  classIdOfTest,
  logInAsStudent,
  startAttemptToken,
  studentRequests,
} from './support/exam-fixtures.js';
import { publishTypedTest, SAMPLE_PAPER } from './support/paper-fixtures.js';
import { createTestContext, TEST_START_TIME, type TestContext } from './support/test-context.js';

const PAPER = {
  ...SAMPLE_PAPER,
  sections: SAMPLE_PAPER.sections.map((section) => ({
    ...section,
    questions: section.questions.map((question) => ({ ...question, imageNumber: null })),
  })),
};

describe('progress', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestContext();
  });
  afterEach(() => context.cleanUp());

  it('lists released results with chapters for the student, and all marked ones for the teacher', async () => {
    const { test, teacher } = await publishTypedTest(context.app, { paper: PAPER });
    const chapter = await createChapter(teacher, test.subject.id, 'Motion');
    await teacher.patch(`/api/tests/${test.id}`).send({ chapterIds: [chapter.id] });
    const attempt = studentRequests(context.app, await startAttemptToken(context.app, test.code));
    await attempt.post('/api/attempt/answers').send({
      answers: [
        { questionId: 'q1', choice: 1, text: null, sequence: 1, answeredAt: TEST_START_TIME },
      ],
    });
    await attempt.post('/api/attempt/finish');
    await teacher.get(`/api/tests/${test.id}/marking`);
    const student = await logInAsStudent(context.app, classIdOfTest(context.app, test.code));

    expect((await student.get('/api/student/progress')).body.results).toEqual([]);
    const studentId = (await student.get('/api/student-auth/session')).body.student.id;
    const teacherView = await teacher.get(`/api/students/${studentId}/progress`);
    expect(teacherView.body.results).toEqual([
      expect.objectContaining({ marks: 1, maxMarks: 5, isReleased: false }),
    ]);

    await teacher
      .put(`/api/tests/${test.id}/release`)
      .send({ showCorrectAnswers: true, showComments: true, showTopScorer: true });
    const progress = await student.get('/api/student/progress');
    expect(progress.body.results).toEqual([
      {
        testCode: test.code,
        testTitle: 'Typed quiz',
        kind: 'test',
        subjectId: test.subject.id,
        subjectName: test.subject.name,
        chapters: [{ id: chapter.id, name: 'Motion' }],
        date: TEST_START_TIME,
        marks: 1,
        maxMarks: 5,
        isReleased: true,
      },
    ]);
    expect(progress.body.subjects).toEqual([
      {
        id: test.subject.id,
        name: test.subject.name,
        chapters: [{ id: chapter.id, name: 'Motion' }],
      },
    ]);
  });
});
