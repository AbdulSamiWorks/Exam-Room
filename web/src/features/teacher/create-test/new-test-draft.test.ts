import { describe, expect, it } from 'vitest';
import { EMPTY_NEW_TEST_DRAFT, isEmptyNewTestDraft, restoreNewTestDraft } from './new-test-draft';
import { NEW_TEST_SETTINGS } from './test-settings-form';

describe('restoreNewTestDraft', () => {
  it('gives back a saved draft', () => {
    const draft = {
      values: { ...NEW_TEST_SETTINGS, title: 'Chapter 1 Test', chapterIds: [3] },
      paperKind: 'typed',
      offlineMaxMarks: '20',
      paperText: '1. Question [1]',
    };
    expect(restoreNewTestDraft(JSON.parse(JSON.stringify(draft)))).toEqual(draft);
  });

  it('keeps defaults for missing or broken parts', () => {
    const restored = restoreNewTestDraft({
      values: { title: 7, chapterIds: ['x'], durationMinutes: '45' },
      paperKind: 'video',
    });
    expect(restored.values).toEqual({ ...NEW_TEST_SETTINGS, durationMinutes: '45' });
    expect(restored.paperKind).toBe('pages');
    expect(restoreNewTestDraft('nonsense')).toBe(EMPTY_NEW_TEST_DRAFT);
  });

  it('knows an untouched form', () => {
    expect(isEmptyNewTestDraft(restoreNewTestDraft({}))).toBe(true);
    expect(isEmptyNewTestDraft({ ...EMPTY_NEW_TEST_DRAFT, paperText: 'x' })).toBe(false);
  });
});
