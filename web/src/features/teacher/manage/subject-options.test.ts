import type { ClassSubjectSummary, ClassSummary } from '@exam-room/shared';
import { describe, expect, it } from 'vitest';
import { otherSubjectOptions, subjectOptionsOf } from './subject-options';

function subject(id: number, name: string): ClassSubjectSummary {
  return { id, name, testCount: 0, chapters: [] };
}

const classNine: ClassSummary = {
  id: 1,
  name: 'Class 9',
  studentCount: 0,
  subjects: [subject(11, 'Physics'), subject(12, 'Math')],
};

const classTen: ClassSummary = {
  id: 2,
  name: 'Class 10',
  studentCount: 0,
  subjects: [subject(21, 'Physics')],
};

describe('subjectOptionsOf', () => {
  it('names only the subject when there is one class', () => {
    expect(subjectOptionsOf([classNine])).toEqual([
      { subjectId: 11, label: 'Physics' },
      { subjectId: 12, label: 'Math' },
    ]);
  });

  it('adds the class name when there are several classes', () => {
    expect(subjectOptionsOf([classNine, classTen]).map((option) => option.label)).toEqual([
      'Physics · Class 9',
      'Math · Class 9',
      'Physics · Class 10',
    ]);
  });
});

describe('otherSubjectOptions', () => {
  it('lists every other subject of every class', () => {
    expect(otherSubjectOptions([classNine, classTen], 11)).toEqual([
      { subjectId: 12, label: 'Math · Class 9' },
      { subjectId: 21, label: 'Physics · Class 10' },
    ]);
  });
});
