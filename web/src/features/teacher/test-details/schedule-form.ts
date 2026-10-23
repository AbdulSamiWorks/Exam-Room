import type { ScheduleTestRequest, TestSummary } from '@exam-room/shared';
import { fromDateTimeInputValue, toDateTimeInputValue } from '../../../lib/date-time-input';

export type ScheduleFormValues = {
  opensAt: string;
  closesAt: string;
};

export type ScheduleFormErrors = Partial<Record<keyof ScheduleFormValues, string>>;

export type ScheduleFormResult =
  { isValid: true; schedule: ScheduleTestRequest } | { isValid: false; errors: ScheduleFormErrors };

export function initialScheduleFormValues(test: TestSummary): ScheduleFormValues {
  return {
    opensAt: test.opensAt === null ? '' : toDateTimeInputValue(test.opensAt),
    closesAt: test.closesAt === null ? '' : toDateTimeInputValue(test.closesAt),
  };
}

export function readScheduleForm(values: ScheduleFormValues): ScheduleFormResult {
  const opensAt = fromDateTimeInputValue(values.opensAt);
  const closesAt = fromDateTimeInputValue(values.closesAt) ?? null;

  if (opensAt === undefined) {
    return { isValid: false, errors: { opensAt: 'Choose when the test opens.' } };
  }
  if (closesAt !== null && closesAt <= opensAt) {
    return {
      isValid: false,
      errors: { closesAt: 'The closing time must be after the opening time.' },
    };
  }
  return { isValid: true, schedule: { opensAt, closesAt } };
}
