import { describe, expect, it } from 'vitest';
import { groupBy, pairUp } from '../src/lib/collections.js';
import {
  compareNaturally,
  comparisonKey,
  countOf,
  joinWithAnd,
  tidyText,
} from '../src/lib/text.js';

describe('text helpers', () => {
  it('tidies spaces and compares without letter case', () => {
    expect(tidyText('  Ayesha   Khan ')).toBe('Ayesha Khan');
    expect(comparisonKey(' AYESHA  khan')).toBe('ayesha khan');
  });

  it('sorts numbers inside text in natural order', () => {
    expect(['Class 10', 'class 9', 'Class 1'].sort(compareNaturally)).toEqual([
      'Class 1',
      'class 9',
      'Class 10',
    ]);
  });

  it('counts with the right word form and joins with "and"', () => {
    expect(countOf(1, 'student')).toBe('1 student');
    expect(countOf(3, 'student')).toBe('3 students');
    expect(joinWithAnd([])).toBe('');
    expect(joinWithAnd(['a'])).toBe('a');
    expect(joinWithAnd(['a', 'b', 'c'])).toBe('a, b and c');
  });
});

describe('collection helpers', () => {
  it('groups items by key, keeping their order', () => {
    const groups = groupBy([1, 2, 3, 4, 5], (number) => number % 2);
    expect([...groups]).toEqual([
      [1, [1, 3, 5]],
      [0, [2, 4]],
    ]);
  });

  it('pairs two lists of the same length and refuses different lengths', () => {
    expect(pairUp(['a', 'b'], [1, 2])).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
    expect(() => pairUp(['a'], [1, 2])).toThrow();
  });
});
