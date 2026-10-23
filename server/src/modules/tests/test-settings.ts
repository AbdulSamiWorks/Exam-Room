import type { TestSettings, UpdateTestRequest } from '@exam-room/shared';
import type { TestRecord } from './test-record.js';

const SETTINGS_FIXED_ONCE_STARTED = ['durationMinutes', 'allowedExits', 'leaveRule'] as const;

export function settingsOf(test: TestRecord): TestSettings {
  return {
    subjectId: test.subject.id,
    title: test.title,
    durationMinutes: test.durationMinutes,
    allowedExits: test.allowedExits,
    leaveRule: test.leaveRule,
  };
}

export function changesFixedSettings(test: TestRecord, changes: UpdateTestRequest): boolean {
  if (test.studentCount === 0) return false;
  return SETTINGS_FIXED_ONCE_STARTED.some(
    (setting) => changes[setting] !== undefined && changes[setting] !== test[setting],
  );
}
