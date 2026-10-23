import { createHmac } from 'node:crypto';
import { constantTimeEquals } from '../../lib/crypto.js';

export type StudentSessionClaims = {
  studentId: number;
  sessionVersion: number;
  expiresAt: number;
};

const TOKEN_PURPOSE = 'student-session';
const WHOLE_NUMBER = /^\d+$/;
const TOKEN_PART_COUNT = 4;

export function createStudentSessionToken(secret: string, claims: StudentSessionClaims): string {
  const payload = [claims.studentId, claims.sessionVersion, claims.expiresAt].join('.');
  return `${payload}.${sign(secret, payload)}`;
}

export function readStudentSessionToken(
  secret: string,
  token: string | undefined,
  currentTime: number,
): StudentSessionClaims | undefined {
  const parts = token?.split('.') ?? [];
  if (parts.length !== TOKEN_PART_COUNT) return undefined;

  const numberParts = parts.slice(0, -1);
  const signature = parts.at(-1) ?? '';
  if (!numberParts.every((part) => WHOLE_NUMBER.test(part))) return undefined;
  if (!constantTimeEquals(signature, sign(secret, numberParts.join('.')))) return undefined;

  const [studentId = 0, sessionVersion = 0, expiresAt = 0] = numberParts.map(Number);
  return expiresAt > currentTime ? { studentId, sessionVersion, expiresAt } : undefined;
}

function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(`${TOKEN_PURPOSE}:${payload}`).digest('base64url');
}
