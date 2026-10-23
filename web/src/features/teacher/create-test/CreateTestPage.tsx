import type { AllowedExits, LeaveRule } from '@exam-room/shared';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../../components/Button';
import { ChoiceGroup, type Choice } from '../../../components/ChoiceGroup';
import { FormError } from '../../../components/FormError';
import { Page } from '../../../components/Page';
import { TextField } from '../../../components/TextField';
import { useCreateTest } from '../tests/use-tests';
import {
  buildCreateTestFormData,
  hasErrors,
  validateCreateTestForm,
  type CreateTestFormErrors,
  type CreateTestFormValues,
} from './create-test-form';
import { PdfPicker } from './PdfPicker';
import { SubjectPicker } from './SubjectPicker';
import { testLimits } from './test-limits';
import { usePdfPages } from './use-pdf-pages';
import styles from './CreateTestPage.module.css';

const ALLOWED_EXITS_CHOICES: Choice<AllowedExits>[] = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
];

const LEAVE_RULE_CHOICES: Choice<LeaveRule>[] = [
  { value: 'lock', label: 'Lock (I can unlock)' },
  { value: 'finish', label: 'Finish the test' },
];

const INITIAL_VALUES: CreateTestFormValues = {
  subjectId: '',
  title: '',
  durationMinutes: '30',
  allowedExits: 1,
  leaveRule: 'lock',
};

export function CreateTestPage() {
  const navigate = useNavigate();
  const createTest = useCreateTest();
  const { pdfPages, choosePdf } = usePdfPages();
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState<CreateTestFormErrors>({});

  function updateValue<Field extends keyof CreateTestFormValues>(
    field: Field,
    value: CreateTestFormValues[Field],
  ) {
    setValues((currentValues) => ({ ...currentValues, [field]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
  }

  function choosePdfFile(pdfFile: File) {
    setErrors((currentErrors) => ({ ...currentErrors, pdf: undefined }));
    void choosePdf(pdfFile);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateCreateTestForm(values, pdfPages);
    setErrors(validationErrors);
    if (hasErrors(validationErrors) || pdfPages.status !== 'ready') return;

    createTest.mutate(buildCreateTestFormData(values, pdfPages.pages), {
      onSuccess: ({ test }) => navigate(`/teacher/tests/${test.id}`),
    });
  }

  return (
    <Page title="New test" backLink={{ to: '/teacher', label: 'All tests' }}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <PdfPicker pdfPages={pdfPages} onChoose={choosePdfFile} errorMessage={errors.pdf} />

        <SubjectPicker
          selectedSubjectId={values.subjectId}
          onSelect={(subjectId) => updateValue('subjectId', subjectId)}
          errorMessage={errors.subjectId}
        />

        <TextField
          label="Title"
          placeholder="e.g. Chapter 3 Quiz"
          value={values.title}
          maxLength={testLimits.maxTitleLength}
          onChange={(event) => updateValue('title', event.target.value)}
          errorMessage={errors.title}
        />

        <TextField
          label="Time limit (minutes)"
          type="number"
          inputMode="numeric"
          min={testLimits.minDurationMinutes}
          max={testLimits.maxDurationMinutes}
          value={values.durationMinutes}
          onChange={(event) => updateValue('durationMinutes', event.target.value)}
          errorMessage={errors.durationMinutes}
        />

        <ChoiceGroup
          label="Allowed exits"
          hint="How many times a student may leave the test before it locks."
          choices={ALLOWED_EXITS_CHOICES}
          selectedValue={values.allowedExits}
          onChange={(allowedExits) => updateValue('allowedExits', allowedExits)}
        />

        <ChoiceGroup
          label="When a student leaves too often"
          hint="Finish the test means the student cannot come back, and you cannot unlock it."
          choices={LEAVE_RULE_CHOICES}
          selectedValue={values.leaveRule}
          onChange={(leaveRule) => updateValue('leaveRule', leaveRule)}
        />

        {createTest.error && <FormError>{createTest.error.message}</FormError>}

        <Button type="submit" size="large" fullWidth disabled={createTest.isPending}>
          {createTest.isPending ? 'Creating test…' : 'Create test'}
        </Button>
      </form>
    </Page>
  );
}
