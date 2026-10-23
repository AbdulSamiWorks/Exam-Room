import type {
  AllowedExits,
  LeaveRule,
  TestSettings,
  TestSummary,
  UpdateTestRequest,
} from '@exam-room/shared';
import { testLimits } from './test-limits';

export type TestSettingsFormValues = {
  subjectId: string;
  title: string;
  durationMinutes: string;
  allowedExits: AllowedExits;
  leaveRule: LeaveRule;
};

export type TestSettingsFormErrors = Partial<
  Record<'subjectId' | 'title' | 'durationMinutes', string>
>;

export const NEW_TEST_SETTINGS: TestSettingsFormValues = {
  subjectId: '',
  title: '',
  durationMinutes: '30',
  allowedExits: 1,
  leaveRule: 'lock',
};

export function settingsFormValuesOf(test: TestSummary): TestSettingsFormValues {
  return {
    subjectId: String(test.subject.id),
    title: test.title,
    durationMinutes: String(test.durationMinutes),
    allowedExits: test.allowedExits,
    leaveRule: test.leaveRule,
  };
}

export function validateTestSettings(values: TestSettingsFormValues): TestSettingsFormErrors {
  const errors: TestSettingsFormErrors = {};

  if (!values.subjectId) errors.subjectId = 'Choose a subject.';

  const title = values.title.trim();
  if (!title) errors.title = 'Enter a title for the test.';
  else if (title.length > testLimits.maxTitleLength) {
    errors.title = `Use at most ${testLimits.maxTitleLength} characters.`;
  }

  const durationMinutes = Number(values.durationMinutes);
  const isValidDuration =
    Number.isInteger(durationMinutes) &&
    durationMinutes >= testLimits.minDurationMinutes &&
    durationMinutes <= testLimits.maxDurationMinutes;
  if (!isValidDuration) {
    errors.durationMinutes = `Enter whole minutes from ${testLimits.minDurationMinutes} to ${testLimits.maxDurationMinutes}.`;
  }

  return errors;
}

export function toTestSettings(values: TestSettingsFormValues): TestSettings {
  return {
    subjectId: Number(values.subjectId),
    title: values.title.trim(),
    durationMinutes: Number(values.durationMinutes),
    allowedExits: values.allowedExits,
    leaveRule: values.leaveRule,
  };
}

export function toUpdateTestRequest(
  values: TestSettingsFormValues,
  areRulesFixed: boolean,
): UpdateTestRequest {
  const settings = toTestSettings(values);
  if (!areRulesFixed) return settings;
  return { subjectId: settings.subjectId, title: settings.title };
}

export function hasErrors(errors: object): boolean {
  return Object.values(errors).some(Boolean);
}
