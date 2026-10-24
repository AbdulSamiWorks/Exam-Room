import { readSignedText, signText } from '../../lib/signed-text.js';

export type StudentSessionClaims = {
  studentId: number;
  sessionVersion: number;
  expiresAt: number;
};

const TOKEN_PURPOSE = 'student-session';
const WHOLE_NUMBERS = /^\d+\.\d+\.\d+$/;

export function createStudentSessionToken(secret: string, claims: StudentSessionClaims): string {
  const payload = [claims.studentId, claims.sessionVersion, claims.expiresAt].join('.');
  return signText(secret, TOKEN_PURPOSE, payload);
}

export function readStudentSessionToken(
  secret: string,
  token: string | undefined,
  currentTime: number,
): StudentSessionClaims | undefined {
  const payload = readSignedText(secret, TOKEN_PURPOSE, token);
  if (!payload || !WHOLE_NUMBERS.test(payload)) return undefined;

  const [studentId = 0, sessionVersion = 0, expiresAt = 0] = payload.split('.').map(Number);
  return expiresAt > currentTime ? { studentId, sessionVersion, expiresAt } : undefined;
}
