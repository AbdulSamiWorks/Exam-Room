import type { TestSummary } from '@exam-room/shared';
import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { TextField } from '../../../components/TextField';
import { useScheduleTest } from '../tests/use-tests';
import {
  initialScheduleFormValues,
  readScheduleForm,
  type ScheduleFormErrors,
  type ScheduleFormValues,
} from './schedule-form';
import styles from './ScheduleForm.module.css';

type ScheduleFormProps = {
  test: TestSummary;
  onDone: () => void;
};

export function ScheduleForm({ test, onDone }: ScheduleFormProps) {
  const scheduleTest = useScheduleTest(test.id);
  const [values, setValues] = useState(() => initialScheduleFormValues(test));
  const [errors, setErrors] = useState<ScheduleFormErrors>({});

  function updateValue(field: keyof ScheduleFormValues, value: string) {
    setValues((currentValues) => ({ ...currentValues, [field]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = readScheduleForm(values);
    if (!result.isValid) {
      setErrors(result.errors);
      return;
    }
    scheduleTest.mutate(result.schedule, { onSuccess: onDone });
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <TextField
        label="Opens at"
        type="datetime-local"
        value={values.opensAt}
        onChange={(event) => updateValue('opensAt', event.target.value)}
        errorMessage={errors.opensAt}
      />
      <TextField
        label="Closes at (optional)"
        hint="After this time new students cannot start."
        type="datetime-local"
        value={values.closesAt}
        onChange={(event) => updateValue('closesAt', event.target.value)}
        errorMessage={errors.closesAt}
      />

      {scheduleTest.error && <FormError>{scheduleTest.error.message}</FormError>}

      <div className={styles.actions}>
        <Button variant="secondary" onClick={onDone} disabled={scheduleTest.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={scheduleTest.isPending}>
          {scheduleTest.isPending ? 'Saving…' : 'Save times'}
        </Button>
      </div>
    </form>
  );
}
