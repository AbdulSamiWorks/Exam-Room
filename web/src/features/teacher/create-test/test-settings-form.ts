import type {
  AllowedExits,
  LeaveRule,
  TestKind,
  TestSettings,
  TestSummary,
  UpdateTestRequest,
} from '@exam-room/shared';
import { testLimits } from './test-limits';

export type TestSettingsFormValues = {
  classId: string;
  subjectId: string;
  kind: TestKind;
  chapterIds: number[];
  title: string;
  durationMinutes: string;
  allowedExits: AllowedExits;
  leaveRule: LeaveRule;
};

export type TestSettingsFormErrors = Partial<
  Record<'classId' | 'subjectId' | 'chapterIds' | 'title' | 'durationMinutes', string>
>;

export const NEW_TEST_SETTINGS: TestSettingsFormValues = {
  classId: '',
  subjectId: '',
  kind: 'test',
  chapterIds: [],
  title: '',
  durationMinutes: '30',
  allowedExits: 1,
  leaveRule: 'lock',
};

export function settingsFormValuesOf(test: TestSummary): TestSettingsFormValues {
  return {
    classId: String(test.schoolClass.id),
    subjectId: String(test.subject.id),
    kind: test.kind,
    chapterIds: test.chapters.map((chapter) => chapter.id),
    title: test.title,
    durationMinutes: String(test.durationMinutes),
    allowedExits: test.allowedExits,
    leaveRule: test.leaveRule,
  };
}

export function withClass(values: TestSettingsFormValues, classId: string): TestSettingsFormValues {
  if (classId === values.classId) return values;
  return { ...values, classId, subjectId: '', chapterIds: [] };
}

export function withSubject(
  values: TestSettingsFormValues,
  subjectId: string,
): TestSettingsFormValues {
  if (subjectId === values.subjectId) return values;
  return { ...values, subjectId, chapterIds: [] };
}

export function withChapterToggled(
  values: TestSettingsFormValues,
  chapterId: number,
): TestSettingsFormValues {
  const chapterIds = values.chapterIds.includes(chapterId)
    ? values.chapterIds.filter((selectedId) => selectedId !== chapterId)
    : [...values.chapterIds, chapterId];
  return { ...values, chapterIds };
}

export function validateTestSettings(values: TestSettingsFormValues): TestSettingsFormErrors {
  const errors: TestSettingsFormErrors = {};

  if (!values.classId) errors.classId = 'Choose a class.';
  else if (!values.subjectId) errors.subjectId = 'Choose a subject.';

  if (values.chapterIds.length > testLimits.maxChaptersPerTest) {
    errors.chapterIds = `Choose at most ${testLimits.maxChaptersPerTest} chapters.`;
  }

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
    kind: values.kind,
    chapterIds: values.chapterIds,
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
  const { subjectId, kind, chapterIds, title } = settings;
  return { subjectId, kind, chapterIds, title };
}

export function hasErrors(errors: object): boolean {
  return Object.values(errors).some(Boolean);
}
