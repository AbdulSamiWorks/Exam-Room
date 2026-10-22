import type { SessionResponse } from '@exam-room/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import { constantTimeEquals, sha256 } from '../../lib/crypto.js';
import { HttpError, tooManyRequests } from '../../lib/http-errors.js';
import { parseInput } from '../../lib/parse-input.js';
import { createSessionToken } from './session-token.js';
import {
  isTeacherRequest,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  sessionCookieOptions,
} from './teacher-session.js';

const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGINS_PER_WINDOW = 10;

const loginRequestSchema = z.object({
  password: z.string().min(1, 'Password is required.').max(200),
});

export function createAuthRouter(dependencies: AppDependencies): Router {
  const { config, clock } = dependencies;
  const router = Router();

  const failedLoginLimiter = rateLimit({
    windowMs: FAILED_LOGIN_WINDOW_MS,
    limit: MAX_FAILED_LOGINS_PER_WINDOW,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, _response, next) => {
      next(tooManyRequests('Too many wrong passwords. Try again in 15 minutes.'));
    },
  });

  router.get('/session', (request, response) => {
    const authenticated = isTeacherRequest(request, dependencies);
    response.json({ authenticated } satisfies SessionResponse);
  });

  router.post('/login', failedLoginLimiter, (request, response) => {
    const { password } = parseInput(loginRequestSchema, request.body);
    if (!constantTimeEquals(sha256(password), sha256(config.teacherPassword))) {
      throw new HttpError(401, 'wrong_password', 'Wrong password.');
    }

    const sessionToken = createSessionToken(
      config.sessionSecret,
      clock.now() + SESSION_DURATION_MS,
    );
    response.cookie(SESSION_COOKIE_NAME, sessionToken, {
      ...sessionCookieOptions(config),
      maxAge: SESSION_DURATION_MS,
    });

    response.json({ authenticated: true } satisfies SessionResponse);
  });

  router.post('/logout', (_request, response) => {
    response.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions(config));
    response.json({ authenticated: false } satisfies SessionResponse);
  });

  return router;
}
