import { LibsqlError } from '@libsql/client';
import { describe, expect, it, vi } from 'vitest';
import {
  isTransientDatabaseError,
  retryTransientErrors,
} from '../src/database/transient-errors.js';
import {
  answerProblem,
  isAnswerInTime,
  LATE_ANSWER_WINDOW_MS,
} from '../src/modules/answers/answer-rules.js';

const FINISHED = { status: 'submitted' as const, finishedAt: 100_000 };
const RUNNING = { status: 'in_progress' as const, finishedAt: null };

describe('isAnswerInTime', () => {
  it('accepts everything while the test runs', () => {
    expect(isAnswerInTime(RUNNING, 5000, 4000)).toBe(true);
  });

  it('accepts answers made before the end, with 2 seconds for the phone clock', () => {
    expect(isAnswerInTime(FINISHED, 101_999, 150_000)).toBe(true);
    expect(isAnswerInTime(FINISHED, 102_001, 150_000)).toBe(false);
  });

  it('accepts them only within 10 minutes after the end', () => {
    expect(isAnswerInTime(FINISHED, 90_000, 100_000 + LATE_ANSWER_WINDOW_MS)).toBe(true);
    expect(isAnswerInTime(FINISHED, 90_000, 100_001 + LATE_ANSWER_WINDOW_MS)).toBe(false);
  });

  it('never trusts a phone time later than the arrival', () => {
    expect(isAnswerInTime(FINISHED, 99_000_000, 101_000)).toBe(true);
  });
});

describe('answerProblem', () => {
  const mcq = {
    id: 'q1',
    kind: 'mcq' as const,
    text: 'A?',
    marks: 1,
    options: ['a', 'b'],
    imageNumber: null,
    number: 1,
    sectionIndex: 0,
  };
  const written = { ...mcq, id: 'q2', kind: 'written' as const, options: [], number: 2 };

  it('checks the kind of answer each question takes', () => {
    expect(answerProblem(mcq, { choice: 1, text: null }, 'on_paper')).toBeUndefined();
    expect(answerProblem(mcq, { choice: 2, text: null }, 'on_paper')).toBeDefined();
    expect(answerProblem(written, { choice: null, text: 'x' }, 'typed')).toBeUndefined();
    expect(answerProblem(written, { choice: null, text: 'x' }, 'on_paper')).toBeDefined();
    expect(answerProblem(undefined, { choice: 0, text: null }, 'typed')).toBeDefined();
  });
});

describe('retryTransientErrors', () => {
  const noWait = () => Promise.resolve();

  it('tries again after a short database hiccup', async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new LibsqlError('busy', 'SQLITE_BUSY'))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValue('saved');
    await expect(retryTransientErrors(operation, noWait)).resolves.toBe('saved');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('gives up after three tries and never retries real errors', async () => {
    const alwaysBusy = vi.fn(() => Promise.reject(new LibsqlError('busy', 'SQLITE_BUSY')));
    await expect(retryTransientErrors(alwaysBusy, noWait)).rejects.toThrow('busy');
    expect(alwaysBusy).toHaveBeenCalledTimes(3);

    const broken = vi.fn(() => Promise.reject(new Error('constraint failed')));
    await expect(retryTransientErrors(broken, noWait)).rejects.toThrow('constraint');
    expect(broken).toHaveBeenCalledTimes(1);
    expect(isTransientDatabaseError(new Error('constraint failed'))).toBe(false);
  });
});
