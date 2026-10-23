import type { StudentHomeResponse, StudentSessionResponse } from '@exam-room/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STUDENT_SESSION_DURATION_MS } from '../src/modules/student-auth/student-session.js';
import { createClass } from './support/catalog-fixtures.js';
import {
  addStudentToClass,
  classIdOfTest,
  logInAsStudent,
  publishTest,
  startAttemptToken,
  STUDENT,
  studentRequests,
} from './support/exam-fixtures.js';
import { logInAsTeacher } from './support/teacher-agent.js';
import { createTestContext, type TestContext } from './support/test-context.js';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

describe('student login', () => {
  let context: TestContext;
  let classId: number;
  let pin: string;

  beforeEach(async () => {
    context = await createTestContext();
    const teacher = await logInAsTeacher(context.app);
    classId = (await createClass(teacher, 'Class 9')).id;
    pin = await addStudentToClass(context.app, classId);
  });
  afterEach(() => context.cleanUp());

  function logIn(agent = request.agent(context.app), loginPin = pin, rollNumber = '17') {
    return agent.post('/api/student-auth/login').send({ classId, rollNumber, pin: loginPin });
  }

  function wrongPinOf(correctPin: string): string {
    return correctPin === '111111' ? '222222' : '111111';
  }

  it('lists the classes for the login form without a login', async () => {
    const teacher = await logInAsTeacher(context.app);
    await createClass(teacher, 'Class 10');
    const response = await request(context.app).get('/api/student-auth/classes');
    expect(response.body.classes.map((schoolClass: { name: string }) => schoolClass.name)).toEqual([
      'Class 9',
      'Class 10',
    ]);
  });

  it('logs in with class, roll number and PIN and stays logged in', async () => {
    const student = request.agent(context.app);
    const login = await logIn(student, ` ${pin} `, ' 17 ');

    expect(login.status).toBe(200);
    expect(login.headers['set-cookie']?.[0]).toMatch(/exam_room_student=.*HttpOnly/);
    const session = await student.get('/api/student-auth/session');
    expect(session.body).toEqual({
      student: {
        id: expect.any(Number),
        name: STUDENT.studentName,
        rollNumber: STUDENT.rollNumber,
        schoolClass: { id: classId, name: 'Class 9' },
      },
    } satisfies StudentSessionResponse);
  });

  it('gives the same answer for a wrong PIN and an unknown roll number', async () => {
    const wrongPin = await logIn(undefined, wrongPinOf(pin));
    const unknownRollNumber = await logIn(undefined, pin, '99');
    expect(wrongPin.status).toBe(401);
    expect(unknownRollNumber.body).toEqual(wrongPin.body);
    expect(wrongPin.body.error.code).toBe('wrong_login');
  });

  it('blocks an account for 15 minutes after 10 wrong PINs', async () => {
    for (let wrongTry = 0; wrongTry < 10; wrongTry++) {
      expect((await logIn(undefined, wrongPinOf(pin))).status).toBe(401);
    }
    const blocked = await logIn();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('too_many_wrong_pins');

    const classmatePin = await addStudentToClass(context.app, classId, {
      studentName: 'Bilal Ahmed',
      rollNumber: '18',
    });
    expect((await logIn(undefined, classmatePin, '18')).status).toBe(200);

    context.clock.advanceBy(FIFTEEN_MINUTES_MS);
    expect((await logIn()).status).toBe(200);
  });

  it('logs every phone out when the teacher resets the PIN', async () => {
    const student = request.agent(context.app);
    await logIn(student);
    const teacher = await logInAsTeacher(context.app);
    const studentId = (await student.get('/api/student-auth/session')).body.student.id;

    const reset = await teacher.post(`/api/students/${studentId}/reset-pin`);
    expect((await student.get('/api/student-auth/session')).body.student).toBeNull();
    expect((await logIn(undefined, pin)).status).toBe(401);
    expect((await logIn(undefined, reset.body.pin)).status).toBe(200);
  });

  it('ends the session on logout and after 60 days', async () => {
    const student = request.agent(context.app);
    await logIn(student);
    await student.post('/api/student-auth/logout');
    expect((await student.get('/api/student-auth/session')).body.student).toBeNull();

    await logIn(student);
    context.clock.advanceBy(STUDENT_SESSION_DURATION_MS);
    expect((await student.get('/api/student-auth/session')).body.student).toBeNull();
  });

  it('refuses a session cookie that was changed', async () => {
    const forged = await request(context.app)
      .get('/api/student-auth/session')
      .set('Cookie', 'exam_room_student=1.0.99999999999999.not-a-signature');
    expect(forged.body.student).toBeNull();
  });
});

describe('student home', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestContext();
  });
  afterEach(() => context.cleanUp());

  it('lists the tests of the student class with their state', async () => {
    const openTest = await publishTest(context.app, { title: 'Open quiz' });
    const classId = classIdOfTest(context.app, openTest.code);
    await publishTest(context.app, { title: 'Another class' });
    const attemptToken = await startAttemptToken(context.app, openTest.code);
    await studentRequests(context.app, attemptToken).post('/api/attempt/finish');

    const student = request.agent(context.app);
    const login = await student.post('/api/student-auth/login').send({
      classId,
      rollNumber: '18',
      pin: await addStudentToClass(context.app, classId, {
        studentName: 'Bilal Ahmed',
        rollNumber: '18',
      }),
    });
    expect(login.status).toBe(200);

    const home = await student.get('/api/student/home');
    const body = home.body as StudentHomeResponse;
    expect(body.student.name).toBe('Bilal Ahmed');
    expect(body.tests).toEqual([
      expect.objectContaining({
        code: openTest.code,
        title: 'Open quiz',
        availability: 'open',
        attemptStatus: null,
        finishReason: null,
      }),
    ]);
  });

  it('shows the student their own finished attempt', async () => {
    const test = await publishTest(context.app);
    const attemptToken = await startAttemptToken(context.app, test.code);
    await studentRequests(context.app, attemptToken).post('/api/attempt/finish');

    const student = await logInAsStudent(context.app, classIdOfTest(context.app, test.code));
    const home = await student.get('/api/student/home');
    expect(home.body.tests).toEqual([
      expect.objectContaining({ attemptStatus: 'submitted', finishReason: 'student' }),
    ]);
  });

  it('needs a student login', async () => {
    const response = await request(context.app).get('/api/student/home');
    expect(response.status).toBe(401);
  });
});
