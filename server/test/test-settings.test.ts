import { describe, expect, it } from 'vitest';
import type { TestRecord } from '../src/modules/tests/test-record.js';
import {
  applySettingChanges,
  chapterIdsAfterChange,
  changesFixedSettings,
} from '../src/modules/tests/test-settings.js';

const test: TestRecord = {
  id: 1,
  code: 'K7M2QX',
  kind: 'test',
  title: 'Chapter 3',
  schoolClass: { id: 1, name: 'Class 9' },
  subject: { id: 5, classId: 1, name: 'Physics' },
  durationMinutes: 30,
  allowedExits: 1,
  leaveRule: 'lock',
  writtenAnswers: 'on_paper',
  bountyNote: '',
  bountyPoints: 0,
  waitingRoom: false,
  instantMcqResult: false,
  resultsReleasedAt: null,
  paperKind: 'pages',
  pageCount: 2,
  questionCount: 0,
  maxMarks: null,
  studentCount: 0,
  createdAt: 0,
  opensAt: null,
  closesAt: null,
};

describe('applySettingChanges', () => {
  it('keeps every setting that is not changed', () => {
    expect(applySettingChanges(test, { title: 'New', kind: 'quiz', chapterIds: [3] })).toEqual({
      subjectId: 5,
      kind: 'quiz',
      title: 'New',
      durationMinutes: 30,
      allowedExits: 1,
      leaveRule: 'lock',
      writtenAnswers: 'on_paper',
      bountyNote: '',
      bountyPoints: 0,
      waitingRoom: false,
      instantMcqResult: false,
    });
  });
});

describe('chapterIdsAfterChange', () => {
  it('uses the chosen chapters', () => {
    expect(chapterIdsAfterChange(test, { chapterIds: [3, 4] })).toEqual([3, 4]);
    expect(chapterIdsAfterChange(test, { subjectId: 6, chapterIds: [9] })).toEqual([9]);
  });

  it('clears the chapters when only the subject changes', () => {
    expect(chapterIdsAfterChange(test, { subjectId: 6 })).toEqual([]);
  });

  it('leaves the chapters alone otherwise', () => {
    expect(chapterIdsAfterChange(test, { title: 'New' })).toBeUndefined();
    expect(chapterIdsAfterChange(test, { subjectId: 5 })).toBeUndefined();
  });
});

describe('changesFixedSettings', () => {
  it('allows every change before anyone started', () => {
    expect(changesFixedSettings(test, { durationMinutes: 90 })).toBe(false);
  });

  it('refuses rule changes once a student started, but not labels or chapters', () => {
    const startedTest = { ...test, studentCount: 1 };
    expect(changesFixedSettings(startedTest, { durationMinutes: 90 })).toBe(true);
    expect(changesFixedSettings(startedTest, { kind: 'quiz', chapterIds: [1], title: 'x' })).toBe(
      false,
    );
  });
});
