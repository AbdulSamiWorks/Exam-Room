import { describe, expect, it } from 'vitest';
import { createSessionToken, isSessionTokenValid } from '../src/modules/auth/session-token.js';

const SECRET = 'a-secret-that-is-at-least-32-characters';
const NOW = 1_000_000;
const ONE_HOUR_MS = 60 * 60 * 1000;

describe('session token', () => {
  it('accepts a token before it expires', () => {
    const token = createSessionToken(SECRET, NOW + ONE_HOUR_MS);
    expect(isSessionTokenValid(SECRET, token, NOW)).toBe(true);
  });

  it('rejects a token at or after its expiry time', () => {
    const token = createSessionToken(SECRET, NOW + ONE_HOUR_MS);
    expect(isSessionTokenValid(SECRET, token, NOW + ONE_HOUR_MS)).toBe(false);
  });

  it('rejects a token signed with another secret', () => {
    const token = createSessionToken('another-secret-that-is-also-32-chars', NOW + ONE_HOUR_MS);
    expect(isSessionTokenValid(SECRET, token, NOW)).toBe(false);
  });

  it.each([undefined, '', 'garbage', '123', '123.abc.def', 'abc.signature', '1e20.signature'])(
    'rejects malformed token %j',
    (token) => {
      expect(isSessionTokenValid(SECRET, token, NOW)).toBe(false);
    },
  );
});
