import { describe, expect, it } from 'vitest';
import { describeMarks, describeScore } from './describe-marks';

describe('describeMarks', () => {
  it('writes whole and half marks', () => {
    expect(describeMarks(1)).toBe('1 mark');
    expect(describeMarks(3)).toBe('3 marks');
    expect(describeMarks(0.5)).toBe('½ mark');
    expect(describeMarks(2.5)).toBe('2½ marks');
  });
});

describe('describeScore', () => {
  it('writes a score with its percentage', () => {
    expect(describeScore(7.5, 10)).toBe('7½ / 10 (75%)');
    expect(describeScore(0, 0)).toBe('0 / 0 (0%)');
  });
});
