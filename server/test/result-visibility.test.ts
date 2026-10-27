import { describe, expect, it } from 'vitest';
import { resultVisibility } from '../src/modules/marking/result-visibility.js';
import { attemptRecord, DEADLINE_AT, STARTED_AT } from './support/attempt-record-fixtures.js';

const typedTest = { resultsReleasedAt: null, instantResult: true, paperKind: 'typed' } as const;

describe('resultVisibility', () => {
  it('shows the full result once it is released', () => {
    const released = { ...typedTest, resultsReleasedAt: 1 };
    expect(resultVisibility(released, attemptRecord(), STARTED_AT)).toBe('final');
  });

  it('shows the automatic marks only after the student has finished', () => {
    expect(resultVisibility(typedTest, attemptRecord(), STARTED_AT)).toBe('hidden');
    expect(resultVisibility(typedTest, attemptRecord(), DEADLINE_AT)).toBe('automatic_only');
    const finished = attemptRecord({ status: 'submitted', finishedAt: STARTED_AT });
    expect(resultVisibility(typedTest, finished, STARTED_AT)).toBe('automatic_only');
    const locked = attemptRecord({ status: 'locked' });
    expect(resultVisibility(typedTest, locked, STARTED_AT)).toBe('hidden');
  });

  it('keeps everything hidden when the teacher releases results later', () => {
    const finished = attemptRecord({ status: 'submitted', finishedAt: STARTED_AT });
    const later = { ...typedTest, instantResult: false };
    expect(resultVisibility(later, finished, STARTED_AT)).toBe('hidden');
    const offline = { ...typedTest, paperKind: 'none' } as const;
    expect(resultVisibility(offline, finished, STARTED_AT)).toBe('hidden');
  });
});
