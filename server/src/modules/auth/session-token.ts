import { createHmac } from 'node:crypto';
import { constantTimeEquals } from '../../lib/crypto.js';

const ONLY_DIGITS = /^\d+$/;

export function createSessionToken(secret: string, expiresAt: number): string {
  return `${expiresAt}.${signExpiry(secret, expiresAt)}`;
}

export function isSessionTokenValid(
  secret: string,
  token: string | undefined,
  currentTime: number,
): boolean {
  if (!token) return false;

  const [expiresAtText, signature, ...unexpectedParts] = token.split('.');
  if (!expiresAtText || !signature || unexpectedParts.length > 0) return false;
  if (!ONLY_DIGITS.test(expiresAtText)) return false;

  const expiresAt = Number(expiresAtText);
  if (expiresAt <= currentTime) return false;

  return constantTimeEquals(signature, signExpiry(secret, expiresAt));
}

function signExpiry(secret: string, expiresAt: number): string {
  return createHmac('sha256', secret).update(`teacher-session:${expiresAt}`).digest('base64url');
}
