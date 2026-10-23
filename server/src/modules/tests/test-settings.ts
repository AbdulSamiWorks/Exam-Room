import type { TestSettings, UpdateTestRequest } from '@exam-room/shared';
import type { TestRecord } from './test-record.js';

export type StoredTestSettings = Omit<TestSettings, 'chapterIds'>;

const SETTINGS_FIXED_ONCE_STARTED = [
  'durationMinutes',
  'allowedExits',
  'leaveRule',
  'writtenAnswers',
] as const;

export function settingsOf(test: TestRecord): StoredTestSettings {
  return {
    subjectId: test.subject.id,
    kind: test.kind,
    title: test.title,
    durationMinutes: test.durationMinutes,
    allowedExits: test.allowedExits,
    leaveRule: test.leaveRule,
    writtenAnswers: test.writtenAnswers,
  };
}

export function applySettingChanges(
  test: TestRecord,
  { chapterIds: _chapterIds, ...changes }: UpdateTestRequest,
): StoredTestSettings {
  const current = settingsOf(test);
  return {
    subjectId: changes.subjectId ?? current.subjectId,
    kind: changes.kind ?? current.kind,
    title: changes.title ?? current.title,
    durationMinutes: changes.durationMinutes ?? current.durationMinutes,
    allowedExits: changes.allowedExits ?? current.allowedExits,
    leaveRule: changes.leaveRule ?? current.leaveRule,
    writtenAnswers: changes.writtenAnswers ?? current.writtenAnswers,
  };
}

export function chapterIdsAfterChange(
  test: TestRecord,
  changes: UpdateTestRequest,
): number[] | undefined {
  if (changes.chapterIds !== undefined) return changes.chapterIds;
  const changesSubject = changes.subjectId !== undefined && changes.subjectId !== test.subject.id;
  return changesSubject ? [] : undefined;
}

export function changesFixedSettings(test: TestRecord, changes: UpdateTestRequest): boolean {
  if (test.studentCount === 0) return false;
  return SETTINGS_FIXED_ONCE_STARTED.some(
    (setting) => changes[setting] !== undefined && changes[setting] !== test[setting],
  );
}
