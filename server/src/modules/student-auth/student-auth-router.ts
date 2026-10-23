import type { LoginClassListResponse, StudentSessionResponse } from '@exam-room/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import { HttpError, tooManyRequests } from '../../lib/http-errors.js';
import { positiveId } from '../../lib/input-fields.js';
import { parseInput } from '../../lib/parse-input.js';
import { comparisonKey } from '../../lib/text.js';
import { listClasses } from '../classes/classes-repository.js';
import { hashPin, isWellFormedPin, verifyPin } from '../students/pin.js';
import { studentLimits } from '../students/student-limits.js';
import { findStudentLogin } from '../students/students-repository.js';
import { endStudentSession, findSessionStudent, startStudentSession } from './student-session.js';
import { createWrongPinLimiter } from './wrong-pin-limiter.js';

const WRONG_PIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_WRONG_PINS_PER_ACCOUNT = 10;
const MAX_FAILED_LOGINS_PER_NETWORK = 100;
const MAX_TRACKED_ACCOUNTS = 5000;
const MAX_PIN_INPUT_LENGTH = 20;

const loginSchema = z.object({
  classId: positiveId,
  rollNumber: z
    .string()
    .trim()
    .min(1, 'Enter your roll number.')
    .max(studentLimits.maxRollNumberLength, 'Check your roll number.'),
  pin: z.string().trim().min(1, 'Enter your PIN.').max(MAX_PIN_INPUT_LENGTH, 'Check your PIN.'),
});

const wrongLogin = () =>
  new HttpError(
    401,
    'wrong_login',
    'The roll number or PIN is wrong. Check them, or ask your teacher for a new PIN.',
  );

let pinHashForUnknownStudents: Promise<string> | undefined;

function hashForUnknownStudents(): Promise<string> {
  pinHashForUnknownStudents ??= hashPin('000000');
  return pinHashForUnknownStudents;
}

export function createStudentAuthRouter(dependencies: AppDependencies): Router {
  const { database, clock, config } = dependencies;
  const router = Router();
  const wrongPins = createWrongPinLimiter({
    maxWrongPins: MAX_WRONG_PINS_PER_ACCOUNT,
    windowMs: WRONG_PIN_WINDOW_MS,
    maxTrackedAccounts: MAX_TRACKED_ACCOUNTS,
  });

  const failedLoginLimiter = rateLimit({
    windowMs: WRONG_PIN_WINDOW_MS,
    limit: MAX_FAILED_LOGINS_PER_NETWORK,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, _response, next) => {
      next(tooManyRequests('Too many wrong logins from this network. Try again in 15 minutes.'));
    },
  });

  router.get('/classes', async (_request, response) => {
    response.json({ classes: await listClasses(database) } satisfies LoginClassListResponse);
  });

  router.get('/session', async (request, response) => {
    const student = (await findSessionStudent(dependencies, request)) ?? null;
    response.json({ student } satisfies StudentSessionResponse);
  });

  router.post('/login', failedLoginLimiter, async (request, response) => {
    const { classId, rollNumber, pin } = parseInput(loginSchema, request.body);
    const accountKey = `${classId}:${comparisonKey(rollNumber)}`;
    if (wrongPins.isBlocked(accountKey, clock.now())) {
      throw tooManyRequests(
        'Too many wrong PINs. Try again in 15 minutes, or ask your teacher for a new PIN.',
        'too_many_wrong_pins',
      );
    }

    const login = await findStudentLogin(database, classId, comparisonKey(rollNumber));
    const isPinCorrect =
      isWellFormedPin(pin) &&
      (await verifyPin(pin, login?.pinHash ?? (await hashForUnknownStudents())));
    if (!login || !isPinCorrect) {
      wrongPins.recordWrongPin(accountKey, clock.now());
      throw wrongLogin();
    }

    wrongPins.forget(accountKey);
    startStudentSession(response, dependencies, login.account);
    response.json({ student: login.account.profile } satisfies StudentSessionResponse);
  });

  router.post('/logout', (_request, response) => {
    endStudentSession(response, config);
    response.json({ student: null } satisfies StudentSessionResponse);
  });

  return router;
}
