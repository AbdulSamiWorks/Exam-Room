import type {
  AllowedExits,
  LeaveRule,
  TestKind,
  TestSettings,
  TestSummary,
  UpdateTestRequest,
  WrittenAnswers,
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
  writtenAnswers: WrittenAnswers;
  bountyNote: string;
  bountyPoints: string;
  waitingRoom: boolean;
};

export type TestSettingsFormErrors = Partial<
  Record<'subjectId' | 'chapterIds' | 'title' | 'durationMinutes' | 'bountyPoints', string>
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
  writtenAnswers: 'on_paper',
  bountyNote: '',
  bountyPoints: '0',
  waitingRoom: false,
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
    writtenAnswers: test.writtenAnswers,
    bountyNote: test.bountyNote,
    bountyPoints: String(test.bountyPoints),
    waitingRoom: test.waitingRoom,
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

  if (!values.subjectId) errors.subjectId = 'Choose a subject.';

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
  if (!isValidDuration && values.kind !== 'assignment') {
    errors.durationMinutes = `Enter whole minutes from ${testLimits.minDurationMinutes} to ${testLimits.maxDurationMinutes}.`;
  }

  const bountyPoints = Number(values.bountyPoints || 0);
  if (
    !Number.isInteger(bountyPoints) ||
    bountyPoints < 0 ||
    bountyPoints > testLimits.maxBountyPoints
  ) {
    errors.bountyPoints = `Enter whole points from 0 to ${testLimits.maxBountyPoints}.`;
  }

  return errors;
}

export function toTestSettings(values: TestSettingsFormValues): TestSettings {
  return {
    subjectId: Number(values.subjectId),
    kind: values.kind,
    chapterIds: values.chapterIds,
    title: values.title.trim(),
    durationMinutes: Number(values.durationMinutes) || testLimits.minDurationMinutes,
    allowedExits: values.allowedExits,
    leaveRule: values.leaveRule,
    writtenAnswers: values.writtenAnswers,
    bountyNote: values.bountyNote.trim(),
    bountyPoints: Number(values.bountyPoints || 0),
    waitingRoom: values.kind !== 'assignment' && values.waitingRoom,
  };
}

export function toUpdateTestRequest(
  values: TestSettingsFormValues,
  areRulesFixed: boolean,
): UpdateTestRequest {
  const settings = toTestSettings(values);
  if (!areRulesFixed) return settings;
  const { subjectId, kind, chapterIds, title, bountyNote, bountyPoints } = settings;
  return { subjectId, kind, chapterIds, title, bountyNote, bountyPoints };
}

export function hasErrors(errors: object): boolean {
  return Object.values(errors).some(Boolean);
}
