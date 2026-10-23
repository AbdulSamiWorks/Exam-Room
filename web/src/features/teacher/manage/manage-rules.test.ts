import type { ChapterSummary, ClassSubjectSummary, ClassSummary } from '@exam-room/shared';
import { describe, expect, it } from 'vitest';
import {
  chapterIdsAfterMove,
  classDeletionBlocker,
  describeChapterDeletion,
  describeSubjectDeletion,
  otherSubjectChoices,
  pinListText,
  subjectDeletionBlocker,
} from './manage-rules';

function chapter(id: number, name: string, testCount = 0): ChapterSummary {
  return { id, name, position: id, testCount };
}

function subject(overrides: Partial<ClassSubjectSummary> = {}): ClassSubjectSummary {
  return { id: 11, name: 'Physics', testCount: 0, chapters: [], ...overrides };
}

function schoolClass(overrides: Partial<ClassSummary> = {}): ClassSummary {
  return { id: 1, name: 'Class 9', studentCount: 0, subjects: [], ...overrides };
}

describe('deleting', () => {
  it('explains why a class cannot be deleted yet', () => {
    expect(classDeletionBlocker(schoolClass())).toBeUndefined();
    expect(classDeletionBlocker(schoolClass({ studentCount: 2, subjects: [subject()] }))).toBe(
      'Class 9 still has 2 students and 1 subject. Move or delete them first.',
    );
  });

  it('explains why a subject cannot be deleted yet', () => {
    expect(subjectDeletionBlocker(subject())).toBeUndefined();
    expect(subjectDeletionBlocker(subject({ testCount: 3 }))).toBe(
      'Physics still has 3 tests. Move them to another subject or delete them first.',
    );
  });

  it('says what goes with a subject or a chapter', () => {
    expect(describeSubjectDeletion(subject())).toBe('Delete Physics? This cannot be undone.');
    expect(describeSubjectDeletion(subject({ chapters: [chapter(1, 'Motion')] }))).toBe(
      'Delete Physics? Its 1 chapter will be deleted too. This cannot be undone.',
    );
    expect(describeChapterDeletion(chapter(1, 'Motion'))).toBe('Delete the chapter Motion?');
    expect(describeChapterDeletion(chapter(1, 'Motion', 2))).toBe(
      'Delete the chapter Motion? 2 tests will keep their other chapters; only this tag is removed.',
    );
  });
});

describe('chapterIdsAfterMove', () => {
  const chapters = [chapter(1, 'A'), chapter(2, 'B'), chapter(3, 'C')];

  it('swaps a chapter with its neighbour', () => {
    expect(chapterIdsAfterMove(chapters, 2, 'up')).toEqual([2, 1, 3]);
    expect(chapterIdsAfterMove(chapters, 2, 'down')).toEqual([1, 3, 2]);
  });

  it('keeps the order at the edges and for unknown chapters', () => {
    expect(chapterIdsAfterMove(chapters, 1, 'up')).toEqual([1, 2, 3]);
    expect(chapterIdsAfterMove(chapters, 3, 'down')).toEqual([1, 2, 3]);
    expect(chapterIdsAfterMove(chapters, 9, 'up')).toEqual([1, 2, 3]);
  });
});

describe('otherSubjectChoices', () => {
  it('lists every other subject, with the class name when there are several classes', () => {
    const classNine = schoolClass({ subjects: [subject(), subject({ id: 12, name: 'Math' })] });
    expect(otherSubjectChoices([classNine], 11)).toEqual([{ subjectId: 12, label: 'Math' }]);

    const classTen = schoolClass({ id: 2, name: 'Class 10', subjects: [subject({ id: 21 })] });
    expect(otherSubjectChoices([classNine, classTen], 11)).toEqual([
      { subjectId: 12, label: 'Math · Class 9' },
      { subjectId: 21, label: 'Physics · Class 10' },
    ]);
  });
});

describe('pinListText', () => {
  it('lists every student with the new PIN under the class name', () => {
    expect(
      pinListText('Class 9', [
        { student: { id: 1, classId: 1, rollNumber: '1', name: 'Ayesha' }, pin: '012345' },
        { student: { id: 2, classId: 1, rollNumber: '2', name: 'Bilal' }, pin: '987654' },
      ]),
    ).toBe('Class 9 – login PINs\nRoll 1 · Ayesha · PIN 012345\nRoll 2 · Bilal · PIN 987654');
  });
});
