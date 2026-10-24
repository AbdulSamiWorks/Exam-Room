import { describe, expect, it } from 'vitest';
import {
  averagePercentOf,
  describeTestProgress,
  describeTestStage,
  testStageOf,
} from './test-stage';

const facts = {
  availability: 'not_open' as const,
  opensAt: null,
  resultsReleasedAt: null,
  studentCount: 0,
  finishedCount: 0,
  classStudentCount: 12,
  averageMarks: null,
  maxMarks: 50,
};

describe('test stages', () => {
  it('follows a test from not open to results out', () => {
    expect(testStageOf(facts)).toBe('not_open');
    expect(testStageOf({ ...facts, availability: 'open', studentCount: 3 })).toBe('running');
    expect(testStageOf({ ...facts, availability: 'closed', studentCount: 3 })).toBe('marking');
    expect(testStageOf({ ...facts, availability: 'closed' })).toBe('closed');
    expect(testStageOf({ ...facts, availability: 'scheduled', opensAt: 1 })).toBe('scheduled');
    expect(testStageOf({ ...facts, availability: 'closed', resultsReleasedAt: 5 })).toBe(
      'released',
    );
    expect(describeTestStage({ ...facts, availability: 'closed', studentCount: 3 }).label).toBe(
      'Finished · to mark',
    );
  });

  it('counts who finished and who is still in the test', () => {
    expect(describeTestProgress(facts)).toBe('0 of 12 started');
    expect(describeTestProgress({ ...facts, studentCount: 10, finishedCount: 8 })).toBe(
      '8 of 12 finished · 2 still in the test',
    );
    expect(describeTestProgress({ ...facts, classStudentCount: 0 })).toBe(
      'No students in this class yet',
    );
  });

  it('gives the average only once the results are out', () => {
    expect(averagePercentOf({ ...facts, averageMarks: 36 })).toBeNull();
    expect(averagePercentOf({ ...facts, averageMarks: 36, resultsReleasedAt: 1 })).toBe(72);
  });
});
