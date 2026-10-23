import type { TestSummary } from '@exam-room/shared';
import { describe, expect, it } from 'vitest';
import { groupTestsBySubject, testsOfKind } from './group-tests-by-subject';

function testIn(id: number, className: string, subjectName: string, subjectId: number) {
  return {
    id,
    kind: id % 2 === 0 ? 'quiz' : 'test',
    schoolClass: { id: className.length, name: className },
    subject: { id: subjectId, classId: className.length, name: subjectName },
  } as TestSummary;
}

const tests = [
  testIn(1, 'Class 10', 'Physics', 21),
  testIn(2, 'Class 9', 'Physics', 11),
  testIn(3, 'Class 9', 'Math', 12),
  testIn(4, 'Class 9', 'Physics', 11),
];

describe('groupTestsBySubject', () => {
  it('groups by subject, sorted by class and then subject', () => {
    const groups = groupTestsBySubject(tests, true);
    expect(groups.map((group) => group.heading)).toEqual([
      'Math · Class 9',
      'Physics · Class 9',
      'Physics · Class 10',
    ]);
    expect(groups[1]?.tests.map((test) => test.id)).toEqual([2, 4]);
  });

  it('names only the subject when there is one class', () => {
    expect(groupTestsBySubject(tests.slice(1), false).map((group) => group.heading)).toEqual([
      'Math',
      'Physics',
    ]);
  });
});

describe('testsOfKind', () => {
  it('keeps every test without a filter, otherwise only that type', () => {
    expect(testsOfKind(tests, undefined)).toHaveLength(4);
    expect(testsOfKind(tests, 'quiz').map((test) => test.id)).toEqual([2, 4]);
  });
});
