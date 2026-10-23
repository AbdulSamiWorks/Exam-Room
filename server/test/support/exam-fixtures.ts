import type {
  AllowedExits,
  LeaveRule,
  StartAttemptRequest,
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
};

export const STUDENT: StartAttemptRequest = { studentName: 'Ayesha Khan', rollNumber: '17' };

export async function publishTest(app: Express, settings: TestSettings = {}): Promise<TestSummary> {
  const teacher = await logInAsTeacher(app);
  const subject = await createClassWithSubject(teacher);

  const upload = teacher
    .post('/api/tests')
    .field('subjectId', String(subject.id))
    .field('title', settings.title ?? 'Chapter 3 Quiz')
    .field('durationMinutes', String(settings.durationMinutes ?? 30))
    .field('allowedExits', String(settings.allowedExits ?? 1))
    .field('leaveRule', settings.leaveRule ?? 'lock');

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
  if (settings.isOpen === false) return createdTest;

  const opened = await teacher.post(`/api/tests/${createdTest.id}/open`);
  if (opened.status !== 200) throw new Error(`Opening the test failed: ${opened.status}`);
  return opened.body.test;
}

export function startAttempt(
  app: Express,
  testCode: string,
  student: StartAttemptRequest = STUDENT,
) {
  return request(app).post(`/api/public/tests/${testCode}/attempts`).send(student);
}

export async function startAttemptToken(
  app: Express,
  testCode: string,
  student: StartAttemptRequest = STUDENT,
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
