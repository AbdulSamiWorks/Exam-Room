import type { AllowedExits, LeaveRule } from '@exam-room/shared';
import { ChoiceGroup, type Choice } from '../../../components/ChoiceGroup';
import { TextField } from '../../../components/TextField';
import { SubjectPicker } from './SubjectPicker';
import { testLimits } from './test-limits';
import type { TestSettingsFormErrors, TestSettingsFormValues } from './test-settings-form';

const ALLOWED_EXITS_CHOICES: Choice<AllowedExits>[] = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
];

const LEAVE_RULE_CHOICES: Choice<LeaveRule>[] = [
  { value: 'lock', label: 'Lock (I can unlock)' },
  { value: 'finish', label: 'Finish the test' },
];

export type ChangeTestSetting = <Field extends keyof TestSettingsFormValues>(
  field: Field,
  value: TestSettingsFormValues[Field],
) => void;

type TestSettingsFieldsProps = {
  values: TestSettingsFormValues;
  errors: TestSettingsFormErrors;
  onChange: ChangeTestSetting;
  areRulesFixed?: boolean;
};

export function TestSettingsFields({
  values,
  errors,
  onChange,
  areRulesFixed = false,
}: TestSettingsFieldsProps) {
  return (
    <>
      <SubjectPicker
        selectedSubjectId={values.subjectId}
        onSelect={(subjectId) => onChange('subjectId', subjectId)}
        errorMessage={errors.subjectId}
      />

      <TextField
        label="Title"
        placeholder="e.g. Chapter 3 Quiz"
        value={values.title}
        maxLength={testLimits.maxTitleLength}
        onChange={(event) => onChange('title', event.target.value)}
        errorMessage={errors.title}
      />

      <TextField
        label="Time limit (minutes)"
        type="number"
        inputMode="numeric"
        min={testLimits.minDurationMinutes}
        max={testLimits.maxDurationMinutes}
        value={values.durationMinutes}
        disabled={areRulesFixed}
        onChange={(event) => onChange('durationMinutes', event.target.value)}
        errorMessage={errors.durationMinutes}
      />

      <ChoiceGroup
        label="Allowed exits"
        hint="How many times a student may leave the test before the rule below applies."
        choices={ALLOWED_EXITS_CHOICES}
        selectedValue={values.allowedExits}
        disabled={areRulesFixed}
        onChange={(allowedExits) => onChange('allowedExits', allowedExits)}
      />

      <ChoiceGroup
        label="When a student leaves too often"
        hint="Finish the test means the student cannot come back, and you cannot unlock it."
        choices={LEAVE_RULE_CHOICES}
        selectedValue={values.leaveRule}
        disabled={areRulesFixed}
        onChange={(leaveRule) => onChange('leaveRule', leaveRule)}
      />
    </>
  );
}
