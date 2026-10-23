import { describe, expect, it } from 'vitest';
import { isCompleteOrder } from '../src/modules/chapters/chapter-order.js';
import { classDeletionBlocker } from '../src/modules/classes/class-deletion.js';
import { buildClassTree } from '../src/modules/classes/class-tree.js';
import {
  describeRepeatedRollNumbers,
  describeTakenRollNumbers,
  findRepeatedRollNumbers,
} from '../src/modules/students/new-students.js';

describe('buildClassTree', () => {
  it('nests chapters in subjects and subjects in classes, sorted for reading', () => {
    const tree = buildClassTree({
      classes: [
        { id: 2, name: 'Class 10', studentCount: 0 },
        { id: 1, name: 'Class 9', studentCount: 3 },
      ],
      subjects: [
        { id: 11, classId: 1, name: 'Physics', testCount: 2 },
        { id: 12, classId: 1, name: 'Biology', testCount: 0 },
      ],
      chapters: [
        { id: 102, subjectId: 11, name: 'Forces', position: 2, testCount: 0 },
        { id: 101, subjectId: 11, name: 'Motion', position: 1, testCount: 1 },
      ],
    });

    expect(tree).toEqual([
      {
        id: 1,
        name: 'Class 9',
        studentCount: 3,
        subjects: [
          { id: 12, name: 'Biology', testCount: 0, chapters: [] },
          {
            id: 11,
            name: 'Physics',
            testCount: 2,
            chapters: [
              { id: 101, name: 'Motion', position: 1, testCount: 1 },
              { id: 102, name: 'Forces', position: 2, testCount: 0 },
            ],
          },
        ],
      },
      { id: 2, name: 'Class 10', studentCount: 0, subjects: [] },
    ]);
  });
});

describe('classDeletionBlocker', () => {
  it('allows deleting an empty class', () => {
    expect(classDeletionBlocker('Class 9', { studentCount: 0, subjectCount: 0 })).toBeUndefined();
  });

  it('explains what is still in the class', () => {
    expect(classDeletionBlocker('Class 9', { studentCount: 1, subjectCount: 0 })).toBe(
      'Class 9 still has 1 student. Move or delete them first.',
    );
    expect(classDeletionBlocker('Class 9', { studentCount: 0, subjectCount: 2 })).toBe(
      'Class 9 still has 2 subjects. Move or delete them first.',
    );
  });
});

describe('isCompleteOrder', () => {
  it('accepts every current chapter exactly once in any order', () => {
    expect(isCompleteOrder([1, 2, 3], [3, 1, 2])).toBe(true);
    expect(isCompleteOrder([], [])).toBe(true);
  });

  it('refuses missing, repeated or unknown chapters', () => {
    expect(isCompleteOrder([1, 2, 3], [1, 2])).toBe(false);
    expect(isCompleteOrder([1, 2], [1, 1])).toBe(false);
    expect(isCompleteOrder([1, 2], [1, 2, 2])).toBe(false);
    expect(isCompleteOrder([1, 2], [1, 9])).toBe(false);
  });
});

describe('new students', () => {
  it('finds roll numbers that appear more than once, ignoring case and spaces', () => {
    expect(
      findRepeatedRollNumbers([
        { rollNumber: '10', name: 'A' },
        { rollNumber: 'B-2', name: 'B' },
        { rollNumber: '10', name: 'C' },
        { rollNumber: 'b-2', name: 'D' },
        { rollNumber: '10', name: 'E' },
        { rollNumber: '3', name: 'F' },
      ]),
    ).toEqual(['10', 'B-2']);
  });

  it('describes roll numbers in plain sentences', () => {
    expect(describeRepeatedRollNumbers(['4'])).toBe('Roll number 4 is in the list more than once.');
    expect(describeTakenRollNumbers(['4', '7'], 'Class 9')).toBe(
      'Roll numbers 4, 7 are already used in Class 9.',
    );
  });
});
