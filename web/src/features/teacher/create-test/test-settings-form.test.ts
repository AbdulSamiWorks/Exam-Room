import { describe, expect, it } from 'vitest';
import {
  NEW_TEST_SETTINGS,
  toUpdateTestRequest,
  validateTestSettings,
  withChapterToggled,
  withClass,
  withSubject,
  type TestSettingsFormValues,
} from './test-settings-form';

const filledValues: TestSettingsFormValues = {
  ...NEW_TEST_SETTINGS,
  classId: '1',
  subjectId: '11',
  chapterIds: [3, 4],
  title: ' Chapter 3 Quiz ',
};

describe('changing the class, subject or chapters', () => {
  it('clears the subject and chapters when the class changes', () => {
    expect(withClass(filledValues, '1')).toBe(filledValues);
    expect(withClass(filledValues, '2')).toMatchObject({
      classId: '2',
      subjectId: '',
      chapterIds: [],
    });
  });

  it('clears the chapters when the subject changes', () => {
    expect(withSubject(filledValues, '11')).toBe(filledValues);
    expect(withSubject(filledValues, '12')).toMatchObject({ subjectId: '12', chapterIds: [] });
  });

  it('toggles a chapter on and off', () => {
    expect(withChapterToggled(filledValues, 5).chapterIds).toEqual([3, 4, 5]);
    expect(withChapterToggled(filledValues, 3).chapterIds).toEqual([4]);
  });
});

describe('validateTestSettings', () => {
  it('accepts filled settings', () => {
    expect(validateTestSettings(filledValues)).toEqual({});
  });

  it('explains every missing or wrong field', () => {
    expect(
      validateTestSettings({ ...NEW_TEST_SETTINGS, title: ' ', durationMinutes: '0' }),
    ).toEqual({
      subjectId: 'Choose a subject.',
      title: 'Enter a title for the test.',
      durationMinutes: 'Enter whole minutes from 1 to 600.',
    });
    const tooManyChapters = Array.from({ length: 21 }, (_, index) => index + 1);
    expect(validateTestSettings({ ...filledValues, chapterIds: tooManyChapters })).toEqual({
      chapterIds: 'Choose at most 20 chapters.',
    });
  });
});

describe('assignments and rewards', () => {
  it('needs no time limit for an assignment and checks the reward points', () => {
    expect(
      validateTestSettings({ ...filledValues, kind: 'assignment', durationMinutes: '' }),
    ).toEqual({});
    expect(validateTestSettings({ ...filledValues, bountyPoints: '2.5' })).toEqual({
      bountyPoints: 'Enter whole points from 0 to 1000.',
    });
  });
});

describe('toUpdateTestRequest', () => {
  it('leaves out the exam rules once a student has started', () => {
    expect(toUpdateTestRequest(filledValues, true)).toEqual({
      subjectId: 11,
      kind: 'test',
      chapterIds: [3, 4],
      title: 'Chapter 3 Quiz',
      bountyNote: '',
      bountyPoints: 0,
      instantResult: true,
    });
    expect(toUpdateTestRequest(filledValues, false)).toMatchObject({
      durationMinutes: 30,
      allowedExits: 1,
      leaveRule: 'lock',
      waitingRoom: false,
    });
  });
});
