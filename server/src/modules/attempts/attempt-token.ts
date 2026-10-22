import { randomBytes } from 'node:crypto';

const ATTEMPT_TOKEN_BYTES = 32;
const BEARER_TOKEN_PATTERN = /^Bearer\s+(\S+)$/i;

export function createAttemptToken(): string {
  return randomBytes(ATTEMPT_TOKEN_BYTES).toString('base64url');
}

export function readBearerToken(authorizationHeader: string | undefined): string | undefined {
  return authorizationHeader?.match(BEARER_TOKEN_PATTERN)?.[1];
}
