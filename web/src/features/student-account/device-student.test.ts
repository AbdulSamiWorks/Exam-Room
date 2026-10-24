import { describe, expect, it } from 'vitest';
import { belongsToAnotherStudent } from './device-student';

describe('belongsToAnotherStudent', () => {
  it('is true only when another student used this phone before', () => {
    expect(belongsToAnotherStudent(undefined, 7)).toBe(false);
    expect(belongsToAnotherStudent(7, 7)).toBe(false);
    expect(belongsToAnotherStudent(3, 7)).toBe(true);
  });
});
