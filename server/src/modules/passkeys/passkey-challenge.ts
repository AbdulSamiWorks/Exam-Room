import type { CookieOptions, Request, Response } from 'express';
import type { AppDependencies } from '../../app-dependencies.js';
import { readCookie } from '../../lib/cookies.js';
import { badRequest } from '../../lib/http-errors.js';
import { readSignedText, signText } from '../../lib/signed-text.js';
import { sessionCookieOptions } from '../auth/teacher-session.js';

export type PasskeyCeremony = 'register' | 'login';

const CHALLENGE_COOKIE_NAME = 'exam_room_passkey';
const CHALLENGE_DURATION_MS = 5 * 60 * 1000;
const CHALLENGE_PURPOSE = 'passkey-challenge';
const BASE64URL = /^[\w-]+$/;

export function rememberChallenge(
  response: Response,
  { config, clock }: AppDependencies,
  ceremony: PasskeyCeremony,
  ownerId: number,
  challenge: string,
): void {
  const expiresAt = clock.now() + CHALLENGE_DURATION_MS;
  const value = signText(
    config.sessionSecret,
    CHALLENGE_PURPOSE,
    [ceremony, ownerId, challenge, expiresAt].join('.'),
  );
  response.cookie(CHALLENGE_COOKIE_NAME, value, {
    ...challengeCookieOptions(config),
    maxAge: CHALLENGE_DURATION_MS,
  });
}

export function takeChallenge(
  request: Request,
  response: Response,
  { config, clock }: AppDependencies,
  ceremony: PasskeyCeremony,
  ownerId: number,
): string {
  response.clearCookie(CHALLENGE_COOKIE_NAME, challengeCookieOptions(config));
  const signedValue = readCookie(request.headers.cookie, CHALLENGE_COOKIE_NAME);
  const [storedCeremony, storedOwnerId, challenge = '', expiresAt] =
    readSignedText(config.sessionSecret, CHALLENGE_PURPOSE, signedValue)?.split('.') ?? [];

  const isValid =
    storedCeremony === ceremony &&
    Number(storedOwnerId) === ownerId &&
    BASE64URL.test(challenge) &&
    Number(expiresAt) > clock.now();
  if (!isValid) throw badRequest('This took too long. Please try again.', 'passkey_expired');
  return challenge;
}

function challengeCookieOptions(config: AppDependencies['config']): CookieOptions {
  return { ...sessionCookieOptions(config), path: '/api/student-auth/passkeys' };
}
