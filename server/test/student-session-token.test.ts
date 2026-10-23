import { describe, expect, it } from 'vitest';
import {
  createStudentSessionToken,
  readStudentSessionToken,
} from '../src/modules/student-auth/student-session-token.js';
import { createWrongPinLimiter } from '../src/modules/student-auth/wrong-pin-limiter.js';

const SECRET = 'a-secret-that-is-long-enough-for-tests';
const CLAIMS = { studentId: 12, sessionVersion: 3, expiresAt: 5000 };

describe('student session token', () => {
  it('reads back what it signed until it expires', () => {
    const token = createStudentSessionToken(SECRET, CLAIMS);
    expect(readStudentSessionToken(SECRET, token, 4999)).toEqual(CLAIMS);
    expect(readStudentSessionToken(SECRET, token, 5000)).toBeUndefined();
  });

  it('refuses a changed, foreign or broken token', () => {
    const token = createStudentSessionToken(SECRET, CLAIMS);
    const [, ...rest] = token.split('.');
    expect(readStudentSessionToken(SECRET, ['13', ...rest].join('.'), 0)).toBeUndefined();
    expect(readStudentSessionToken('another-secret', token, 0)).toBeUndefined();
    expect(readStudentSessionToken(SECRET, 'not.a.token', 0)).toBeUndefined();
    expect(readStudentSessionToken(SECRET, undefined, 0)).toBeUndefined();
  });
});

describe('wrong PIN limiter', () => {
  const limits = { maxWrongPins: 2, windowMs: 1000, maxTrackedAccounts: 2 };

  it('blocks an account after too many wrong PINs within the window', () => {
    const limiter = createWrongPinLimiter(limits);
    limiter.recordWrongPin('1:17', 0);
    expect(limiter.isBlocked('1:17', 10)).toBe(false);
    limiter.recordWrongPin('1:17', 20);
    expect(limiter.isBlocked('1:17', 30)).toBe(true);
    expect(limiter.isBlocked('1:18', 30)).toBe(false);
    expect(limiter.isBlocked('1:17', 1000)).toBe(false);
  });

  it('forgets an account after a correct PIN', () => {
    const limiter = createWrongPinLimiter(limits);
    limiter.recordWrongPin('1:17', 0);
    limiter.recordWrongPin('1:17', 0);
    limiter.forget('1:17');
    expect(limiter.isBlocked('1:17', 1)).toBe(false);
  });

  it('drops expired accounts when it tracks too many', () => {
    const limiter = createWrongPinLimiter(limits);
    limiter.recordWrongPin('a', 0);
    limiter.recordWrongPin('a', 0);
    limiter.recordWrongPin('b', 0);
    limiter.recordWrongPin('c', 2000);
    expect(limiter.isBlocked('a', 2000)).toBe(false);
  });
});
