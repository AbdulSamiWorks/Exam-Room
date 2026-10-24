import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deadlineFor, LONGEST_ASSIGNMENT_MS } from '../src/modules/attempts/attempt-rules.js';
import { createClassWithSubject } from './support/catalog-fixtures.js';
import {
  addStudentToClass,
  classIdOfTest,
  logInAsStudent,
  rememberTestClass,
  startAttempt,
  startAttemptToken,
  studentRequests,
} from './support/exam-fixtures.js';
import { publishTypedTest, SAMPLE_PAPER } from './support/paper-fixtures.js';
import { logInAsTeacher } from './support/teacher-agent.js';
import { createTestContext, TEST_START_TIME, type TestContext } from './support/test-context.js';

const PAPER = {
  ...SAMPLE_PAPER,
  sections: SAMPLE_PAPER.sections.map((section) => ({
    ...section,
    questions: section.questions.map((question) => ({ ...question, imageNumber: null })),
  })),
};
const SECOND_STUDENT = { studentName: 'Bilal Ahmed', rollNumber: '18' };

describe('deadlineFor', () => {
  it('uses the time limit for tests and the closing time for assignments', () => {
    const test = { kind: 'test' as const, durationMinutes: 30, closesAt: null };
    expect(deadlineFor(test, 1000)).toBe(1000 + 30 * 60_000);
    expect(deadlineFor({ ...test, kind: 'assignment', closesAt: 99_000 }, 1000)).toBe(99_000);
    expect(deadlineFor({ ...test, kind: 'assignment' }, 1000)).toBe(1000 + LONGEST_ASSIGNMENT_MS);
  });
});

describe('assignments', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestContext();
  });
  afterEach(() => context.cleanUp());

  async function createOfflineAssignment() {
    const teacher = await logInAsTeacher(context.app);
    const subject = await createClassWithSubject(teacher);
    const response = await teacher
      .post('/api/tests')
      .field('subjectId', String(subject.id))
      .field('kind', 'assignment')
      .field('title', 'Lab report')
      .field('durationMinutes', '30')
      .field('allowedExits', '0')
      .field('paperKind', 'none')
      .field('maxMarks', '20')
      .field('bountyNote', 'Best report wins a book')
      .field('bountyPoints', '10');
    return { teacher, response };
  }

  it('creates an offline assignment and lets the teacher enter marks for the class', async () => {
    const { teacher, response } = await createOfflineAssignment();
    expect(response.status).toBe(201);
    const test = response.body.test;
    expect(test).toMatchObject({ kind: 'assignment', paperKind: 'none', maxMarks: 20 });
    rememberTestClass(context.app, test);
    await addStudentToClass(context.app, test.schoolClass.id);
    await addStudentToClass(context.app, test.schoolClass.id, SECOND_STUDENT);

    const empty = await teacher.get(`/api/tests/${test.id}/offline-marks`);
    expect(empty.body.students.map((student: { marks: null }) => student.marks)).toEqual([
      null,
      null,
    ]);
    const [ayesha, bilal] = empty.body.students;

    const saved = await teacher.put(`/api/tests/${test.id}/offline-marks`).send({
      marks: [
        { studentId: ayesha.studentId, marks: 18 },
        { studentId: bilal.studentId, marks: 12.5 },
      ],
    });
    expect(saved.body.students.map((student: { marks: number }) => student.marks)).toEqual([
      18, 12.5,
    ]);
    const tooMany = await teacher
      .put(`/api/tests/${test.id}/offline-marks`)
      .send({ marks: [{ studentId: ayesha.studentId, marks: 21 }] });
    expect(tooMany.status).toBe(400);

    const marking = await teacher.get(`/api/tests/${test.id}/marking`);
    expect(
      marking.body.attempts.map(
        (attempt: { score: { totalMarks: number } }) => attempt.score.totalMarks,
      ),
    ).toEqual([18, 12.5]);

    const studentStart = await startAttempt(context.app, test.code, {
      studentName: 'Sana Iqbal',
      rollNumber: '19',
    });
    expect(studentStart.status).toBe(403);
    expect(studentStart.body.error.code).toBe('offline_assignment');
  });

  it('gives the bounty points to the top scorer on release and takes them back on hide', async () => {
    const { teacher, response } = await createOfflineAssignment();
    const test = response.body.test;
    rememberTestClass(context.app, test);
    const student = await logInAsStudent(context.app, test.schoolClass.id);
    await addStudentToClass(context.app, test.schoolClass.id, SECOND_STUDENT);
    const { body } = await teacher.get(`/api/tests/${test.id}/offline-marks`);
    await teacher.put(`/api/tests/${test.id}/offline-marks`).send({
      marks: [
        { studentId: body.students[0].studentId, marks: 18 },
        { studentId: body.students[1].studentId, marks: 12 },
      ],
    });

    await teacher
      .put(`/api/tests/${test.id}/release`)
      .send({ showCorrectAnswers: true, showComments: true, showTopScorer: true });
    const home = await student.get('/api/student/home');
    expect(home.body).toMatchObject({
      points: 10,
      classLeaders: [{ name: 'Ayesha Khan', points: 10 }],
    });
    expect(home.body.tests[0]).toMatchObject({ releasedMarks: 18, bountyPoints: 10 });

    await teacher.delete(`/api/tests/${test.id}/release`);
    expect((await student.get('/api/student/home')).body.points).toBe(0);
  });

  it('lets the teacher add and remove points by hand with a reason', async () => {
    const { response } = await createOfflineAssignment();
    const classId = response.body.test.schoolClass.id;
    const teacher = await logInAsTeacher(context.app);
    await addStudentToClass(context.app, classId);
    const students = await teacher.get(`/api/classes/${classId}/points`);
    const studentId = students.body.students[0].studentId;

    await teacher
      .post(`/api/students/${studentId}/points`)
      .send({ points: 5, reason: 'Helped a classmate' });
    const history = await teacher
      .post(`/api/students/${studentId}/points`)
      .send({ points: -2, reason: 'Late homework' });
    expect(history.body.total).toBe(3);
    expect(history.body.entries.map((entry: { reason: string }) => entry.reason)).toEqual([
      'Late homework',
      'Helped a classmate',
    ]);
    const noReason = await teacher
      .post(`/api/students/${studentId}/points`)
      .send({ points: 1, reason: ' ' });
    expect(noReason.status).toBe(400);
  });

  it('runs an in-app assignment without a time limit and without counting exits', async () => {
    const teacher = await logInAsTeacher(context.app);
    const { test } = await publishTypedTest(context.app, { paper: PAPER });
    await teacher.patch(`/api/tests/${test.id}`).send({ kind: 'assignment' });
    const closesAt = TEST_START_TIME + 3 * 24 * 60 * 60 * 1000;
    await teacher
      .put(`/api/tests/${test.id}/schedule`)
      .send({ opensAt: TEST_START_TIME, closesAt });

    const student = studentRequests(context.app, await startAttemptToken(context.app, test.code));
    const state = await student.get('/api/attempt');
    expect(state.body.attempt.deadlineAt).toBe(closesAt);
    const exit = await student
      .post('/api/attempt/exits')
      .send({ clientExitId: 'exit-one-01', reason: 'hidden' });
    expect(exit.body.attempt.exitsUsed).toBe(0);
    expect(classIdOfTest(context.app, test.code)).toBeGreaterThan(0);
    expect((await request(context.app).get(`/api/public/tests/${test.code}`)).body.test.kind).toBe(
      'assignment',
    );
  });
});
