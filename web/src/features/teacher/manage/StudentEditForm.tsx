import type { ClassSummary, Student } from '@exam-room/shared';
import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { SelectField } from '../../../components/SelectField';
import { TextField } from '../../../components/TextField';
import { studentLimits } from '../../../lib/student-limits';
import { studentChanges, type StudentFormValues } from './manage-rules';
import { useUpdateStudent } from './use-students';
import styles from './InlineForm.module.css';

type StudentEditFormProps = {
  student: Student;
  classes: ClassSummary[];
  onDone: () => void;
};

export function StudentEditForm({ student, classes, onDone }: StudentEditFormProps) {
  const updateStudent = useUpdateStudent(student.id);
  const [values, setValues] = useState<StudentFormValues>({
    rollNumber: student.rollNumber,
    name: student.name,
    classId: student.classId,
  });
  const [errorMessage, setErrorMessage] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!values.rollNumber.trim() || !values.name.trim()) {
      setErrorMessage('Enter the roll number and the name.');
      return;
    }
    const changes = studentChanges(student, values);
    if (Object.keys(changes).length > 0) {
      const saved = await updateStudent.mutateAsync(changes).catch(() => undefined);
      if (!saved) return;
    }
    onDone();
  }

  function change(changedValues: Partial<StudentFormValues>) {
    setValues((current) => ({ ...current, ...changedValues }));
    setErrorMessage(undefined);
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
      <TextField
        label="Roll number"
        value={values.rollNumber}
        maxLength={studentLimits.maxRollNumberLength}
        autoFocus
        onChange={(event) => change({ rollNumber: event.target.value })}
      />
      <TextField
        label="Name"
        value={values.name}
        maxLength={studentLimits.maxNameLength}
        onChange={(event) => change({ name: event.target.value })}
      />
      {classes.length > 1 && (
        <SelectField
          label="Class"
          value={values.classId}
          onChange={(event) => change({ classId: Number(event.target.value) })}
        >
          {classes.map((schoolClass) => (
            <option key={schoolClass.id} value={schoolClass.id}>
              {schoolClass.name}
            </option>
          ))}
        </SelectField>
      )}
      {(errorMessage ?? updateStudent.error) && (
        <FormError>{errorMessage ?? updateStudent.error?.message}</FormError>
      )}
      <div className={styles.actions}>
        <Button type="submit" disabled={updateStudent.isPending}>
          {updateStudent.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="secondary" onClick={onDone} disabled={updateStudent.isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
