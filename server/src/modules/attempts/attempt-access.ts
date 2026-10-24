import type { Request } from 'express';
import type { AppDependencies } from '../../app-dependencies.js';
import { sha256 } from '../../lib/crypto.js';
import { HttpError } from '../../lib/http-errors.js';
import type { AttemptRecord } from './attempt-record.js';
import { enforceTimeLimit } from './attempt-service.js';
import { readBearerToken } from './attempt-token.js';
import { findAttemptByTokenHash } from './attempts-repository.js';

export async function loadAttemptOfRequest(
  { database, clock }: AppDependencies,
  request: Request,
): Promise<AttemptRecord> {
  const attemptToken = readBearerToken(request.headers.authorization);
  const attempt = attemptToken
    ? await findAttemptByTokenHash(database, sha256(attemptToken))
    : undefined;
  if (!attempt) {
    throw new HttpError(
      401,
      'attempt_not_found',
      'Your test session was not found. Open the test link again.',
    );
  }
  return enforceTimeLimit(database, attempt, clock.now());
}
