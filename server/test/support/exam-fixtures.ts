import type {
  AddStudentsResponse,
  AllowedExits,
  LeaveRule,
  StartAttemptResponse,
  TestSummary,
} from '@exam-room/shared';
import type { Express } from 'express';
import request from 'supertest';
import { createClassWithSubject } from './catalog-fixtures.js';
import { createBlankPageImage } from './page-image-fixtures.js';
import { logInAsTeacher } from './teacher-agent.js';

export type TestSettings = {
  title?: string;
  durationMinutes?: number;
  allowedExits?: AllowedExits;
  leaveRule?: LeaveRule;
  pageImages?: Buffer[];
  isOpen?: boolean;
  waitingRoom?: boolean;
};

export type StudentIdentity = {
  studentName: string;
  rollNumber: string;
};

export type StudentAgent = ReturnType<typeof request.agent>;

export const STUDENT: StudentIdentity = { studentName: 'Ayesha Khan', rollNumber: '17' };

const classIdsByTestCode = new WeakMap<Express, Map<string, number>>();
const studentAgentsByAccount = new WeakMap<Express, Map<string, StudentAgent>>();

function entriesOf<Value>(
  store: WeakMap<Express, Map<string, Value>>,
  app: Express,
): Map<string, Value> {
  const entries = store.get(app) ?? new Map<string, Value>();
  store.set(app, entries);
  return entries;
}

export async function addStudentToClass(
  app: Express,
  classId: number,
  student: StudentIdentity = STUDENT,
): Promise<string> {
  const teacher = await logInAsTeacher(app);
  const response = await teacher
    .post(`/api/classes/${classId}/students`)
    .send({ students: [{ rollNumber: student.rollNumber, name: student.studentName }] });
  if (response.status !== 201) throw new Error(`Adding the student failed: ${response.status}`);
  return (response.body as AddStudentsResponse).students[0]?.pin ?? '';
}

export async function logInAsStudent(
  app: Express,
  classId: number,
  student: StudentIdentity = STUDENT,
): Promise<StudentAgent> {
  const agents = entriesOf(studentAgentsByAccount, app);
  const accountKey = `${classId}:${student.rollNumber}`;
  const knownAgent = agents.get(accountKey);
  if (knownAgent) return knownAgent;

  const pin = await addStudentToClass(app, classId, student);
  const agent = request.agent(app);
  const login = await agent
    .post('/api/student-auth/login')
    .send({ classId, rollNumber: student.rollNumber, pin });
  if (login.status !== 200) throw new Error(`Student login failed: ${login.status}`);
  agents.set(accountKey, agent);
  return agent;
}

export function rememberTestClass(app: Express, test: TestSummary): void {
  entriesOf(classIdsByTestCode, app).set(test.code, test.schoolClass.id);
}

export function classIdOfTest(app: Express, testCode: string): number {
  const classId = entriesOf(classIdsByTestCode, app).get(testCode);
  if (classId === undefined) throw new Error(`Test ${testCode} was not published by publishTest.`);
  return classId;
}

export async function publishTest(app: Express, settings: TestSettings = {}): Promise<TestSummary> {
  const teacher = await logInAsTeacher(app);
  const subject = await createClassWithSubject(teacher);

  const upload = teacher
    .post('/api/tests')
    .field('subjectId', String(subject.id))
    .field('title', settings.title ?? 'Chapter 3 Quiz')
    .field('durationMinutes', String(settings.durationMinutes ?? 30))
    .field('allowedExits', String(settings.allowedExits ?? 1))
    .field('leaveRule', settings.leaveRule ?? 'lock')
    .field('waitingRoom', String(settings.waitingRoom ?? false));

  const pageImages = settings.pageImages ?? [await createBlankPageImage()];
  pageImages.forEach((pageImage, pageIndex) => {
    upload.attach('pages', pageImage, {
      filename: `page-${pageIndex + 1}.png`,
      contentType: 'image/png',
    });
  });

  const response = await upload;
  if (response.status !== 201) throw new Error(`Test creation failed: ${response.status}`);
  const createdTest: TestSummary = response.body.test;
  rememberTestClass(app, createdTest);
  if (settings.isOpen === false) return createdTest;

  const opened = await teacher.post(`/api/tests/${createdTest.id}/open`);
  if (opened.status !== 200) throw new Error(`Opening the test failed: ${opened.status}`);
  return opened.body.test;
}

export async function startAttempt(
  app: Express,
  testCode: string,
  student: StudentIdentity = STUDENT,
) {
  const agent = await logInAsStudent(app, classIdOfTest(app, testCode), student);
  return agent.post(`/api/public/tests/${testCode}/attempts`).send();
}

export async function startAttemptToken(
  app: Express,
  testCode: string,
  student: StudentIdentity = STUDENT,
): Promise<string> {
  const response = await startAttempt(app, testCode, student);
  if (response.status !== 201) throw new Error(`Starting the attempt failed: ${response.status}`);
  return (response.body as StartAttemptResponse).attemptToken;
}

export function studentRequests(app: Express, attemptToken: string) {
  const authorization = `Bearer ${attemptToken}`;
  return {
    get: (path: string) => request(app).get(path).set('Authorization', authorization),
    post: (path: string) => request(app).post(path).set('Authorization', authorization),
  };
}
