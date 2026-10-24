import type { PaperKind } from '@exam-room/shared';
import { NEW_TEST_SETTINGS, type TestSettingsFormValues } from './test-settings-form';

export type NewTestDraft = {
  values: TestSettingsFormValues;
  paperKind: PaperKind;
  offlineMaxMarks: string;
  paperText: string;
};

export const EMPTY_NEW_TEST_DRAFT: NewTestDraft = {
  values: NEW_TEST_SETTINGS,
  paperKind: 'pages',
  offlineMaxMarks: '20',
  paperText: '',
};

const NEW_TEST_DRAFT_KEY = 'exam-room:new-test-draft';
const PAPER_KINDS: ReadonlySet<unknown> = new Set<PaperKind>(['pages', 'typed', 'none']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function restoreValues(stored: unknown): TestSettingsFormValues {
  if (!isRecord(stored)) return NEW_TEST_SETTINGS;
  const values: Record<string, unknown> = { ...NEW_TEST_SETTINGS };
  for (const [key, defaultValue] of Object.entries(NEW_TEST_SETTINGS)) {
    const value = stored[key];
    const isSameType = Array.isArray(defaultValue)
      ? Array.isArray(value) && value.every(Number.isInteger)
      : typeof value === typeof defaultValue;
    if (isSameType) values[key] = value;
  }
  return values as TestSettingsFormValues;
}

export function restoreNewTestDraft(stored: unknown): NewTestDraft {
  if (!isRecord(stored)) return EMPTY_NEW_TEST_DRAFT;
  return {
    values: restoreValues(stored.values),
    paperKind: PAPER_KINDS.has(stored.paperKind)
      ? (stored.paperKind as PaperKind)
      : EMPTY_NEW_TEST_DRAFT.paperKind,
    offlineMaxMarks:
      typeof stored.offlineMaxMarks === 'string'
        ? stored.offlineMaxMarks
        : EMPTY_NEW_TEST_DRAFT.offlineMaxMarks,
    paperText: typeof stored.paperText === 'string' ? stored.paperText : '',
  };
}

export function isEmptyNewTestDraft(draft: NewTestDraft): boolean {
  return JSON.stringify(draft) === JSON.stringify(EMPTY_NEW_TEST_DRAFT);
}

export function readNewTestDraft(): NewTestDraft {
  try {
    const storedText = window.localStorage.getItem(NEW_TEST_DRAFT_KEY);
    return storedText ? restoreNewTestDraft(JSON.parse(storedText)) : EMPTY_NEW_TEST_DRAFT;
  } catch {
    return EMPTY_NEW_TEST_DRAFT;
  }
}

export function saveNewTestDraft(draft: NewTestDraft): void {
  try {
    if (isEmptyNewTestDraft(draft)) window.localStorage.removeItem(NEW_TEST_DRAFT_KEY);
    else window.localStorage.setItem(NEW_TEST_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    return;
  }
}

export function forgetNewTestDraft(): void {
  try {
    window.localStorage.removeItem(NEW_TEST_DRAFT_KEY);
  } catch {
    return;
  }
}
