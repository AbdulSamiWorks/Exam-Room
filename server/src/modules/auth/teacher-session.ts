import type { CookieOptions, Request, RequestHandler } from 'express';
import type { AppDependencies } from '../../app-dependencies.js';
import type { Config } from '../../config.js';
import { readCookie } from '../../lib/cookies.js';
import { unauthorized } from '../../lib/http-errors.js';
import { isSessionTokenValid } from './session-token.js';

export const SESSION_COOKIE_NAME = 'exam_room_session';
export const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

export function isTeacherRequest(request: Request, { config, clock }: AppDependencies): boolean {
  const token = readCookie(request.headers.cookie, SESSION_COOKIE_NAME);
  return isSessionTokenValid(config.sessionSecret, token, clock.now());
}

export function requireTeacher(dependencies: AppDependencies): RequestHandler {
  return (request, _response, next) => {
    next(isTeacherRequest(request, dependencies) ? undefined : unauthorized());
  };
}

export function sessionCookieOptions(config: Config): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.environment === 'production',
    path: '/api',
  };
}
