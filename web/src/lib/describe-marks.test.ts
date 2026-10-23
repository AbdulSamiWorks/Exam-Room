import { describe, expect, it } from 'vitest';
import { describeMarks } from './describe-marks';

describe('describeMarks', () => {
  it('writes whole and half marks', () => {
    expect(describeMarks(1)).toBe('1 mark');
    expect(describeMarks(3)).toBe('3 marks');
    expect(describeMarks(0.5)).toBe('½ mark');
    expect(describeMarks(2.5)).toBe('2½ marks');
  });
});
