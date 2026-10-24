import { describe, expect, it } from 'vitest';
import {
  retryDelayFor,
  shouldTryAgain,
  WAIT_FOR_SERVER_MS,
  type FinishedTry,
} from './request-retry';

const failedPost: FinishedTry = {
  method: 'POST',
  isMarkedRepeatable: false,
  status: undefined,
  wasOffline: false,
  elapsedMs: 0,
};

describe('shouldTryAgain', () => {
  it('waits for a sleeping or restarting server for every request', () => {
    expect(shouldTryAgain({ ...failedPost, status: 502 })).toBe(true);
    expect(shouldTryAgain({ ...failedPost, status: 503 })).toBe(true);
  });

  it('repeats a broken connection only when repeating is safe', () => {
    expect(shouldTryAgain(failedPost)).toBe(false);
    expect(shouldTryAgain({ ...failedPost, method: 'PUT' })).toBe(true);
    expect(shouldTryAgain({ ...failedPost, method: 'get' })).toBe(true);
    expect(shouldTryAgain({ ...failedPost, isMarkedRepeatable: true })).toBe(true);
    expect(shouldTryAgain({ ...failedPost, wasOffline: true })).toBe(true);
    expect(shouldTryAgain({ ...failedPost, status: 504 })).toBe(false);
    expect(shouldTryAgain({ ...failedPost, method: 'DELETE', status: 504 })).toBe(true);
  });

  it('gives back every real answer of the server and stops after two minutes', () => {
    expect(shouldTryAgain({ ...failedPost, status: 200 })).toBe(false);
    expect(shouldTryAgain({ ...failedPost, status: 409 })).toBe(false);
    expect(shouldTryAgain({ ...failedPost, status: 500 })).toBe(false);
    expect(shouldTryAgain({ ...failedPost, status: 503, elapsedMs: WAIT_FOR_SERVER_MS })).toBe(
      false,
    );
  });
});

describe('retryDelayFor', () => {
  it('waits a little longer each time, at most 5 seconds', () => {
    expect([1, 2, 3, 4, 5, 6].map(retryDelayFor)).toEqual([1000, 2000, 3000, 4000, 5000, 5000]);
  });
});
