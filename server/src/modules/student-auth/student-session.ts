import type { StudentProfile } from '@exam-room/shared';
import type { Request, Response } from 'express';
import type { AppDependencies } from '../../app-dependencies.js';
import type { Config } from '../../config.js';
import { readCookie } from '../../lib/cookies.js';
import { unauthorized } from '../../lib/http-errors.js';
import { sessionCookieOptions } from '../auth/teacher-session.js';
import { findStudentAccount, type StudentAccount } from '../students/students-repository.js';
import { createStudentSessionToken, readStudentSessionToken } from './student-session-token.js';

export const STUDENT_SESSION_COOKIE_NAME = 'exam_room_student';
export const STUDENT_SESSION_DURATION_MS = 60 * 24 * 60 * 60 * 1000;

export async function findSessionStudent(
  { config, database, clock }: AppDependencies,
  request: Request,
): Promise<StudentProfile | undefined> {
  const token = readCookie(request.headers.cookie, STUDENT_SESSION_COOKIE_NAME);
  const claims = readStudentSessionToken(config.sessionSecret, token, clock.now());
  if (!claims) return undefined;

  const account = await findStudentAccount(database, claims.studentId);
  if (!account || account.sessionVersion !== claims.sessionVersion) return undefined;
  return account.profile;
}

export async function requireSessionStudent(
  dependencies: AppDependencies,
  request: Request,
): Promise<StudentProfile> {
  const student = await findSessionStudent(dependencies, request);
  if (!student) throw unauthorized('Please log in first.', 'student_login_needed');
  return student;
}

export function startStudentSession(
  response: Response,
  { config, clock }: AppDependencies,
  account: StudentAccount,
): void {
  const token = createStudentSessionToken(config.sessionSecret, {
    studentId: account.profile.id,
    sessionVersion: account.sessionVersion,
    expiresAt: clock.now() + STUDENT_SESSION_DURATION_MS,
  });
  response.cookie(STUDENT_SESSION_COOKIE_NAME, token, {
    ...sessionCookieOptions(config),
    maxAge: STUDENT_SESSION_DURATION_MS,
  });
}

export function endStudentSession(response: Response, config: Config): void {
  response.clearCookie(STUDENT_SESSION_COOKIE_NAME, sessionCookieOptions(config));
}
