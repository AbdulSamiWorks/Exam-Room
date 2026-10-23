import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { TextField } from '../../../components/TextField';
import { studentLimits } from '../../../lib/student-limits';
import type { AddStudentsFormProps } from './AddStudentsForm';
import { useAddStudents } from './use-students';
import styles from './InlineForm.module.css';

type StudentFieldErrors = {
  rollNumber?: string;
  name?: string;
};

export function OneStudentForm({ classId, onAdded }: AddStudentsFormProps) {
  const addStudents = useAddStudents(classId);
  const [rollNumber, setRollNumber] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<StudentFieldErrors>({});

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const newStudent = { rollNumber: rollNumber.trim(), name: name.trim() };
    const fieldErrors: StudentFieldErrors = {
      rollNumber: newStudent.rollNumber ? undefined : 'Enter the roll number.',
      name: newStudent.name ? undefined : "Enter the student's name.",
    };
    setErrors(fieldErrors);
    if (fieldErrors.rollNumber || fieldErrors.name) return;

    const response = await addStudents.mutateAsync([newStudent]).catch(() => undefined);
    if (!response) return;
    onAdded(response.students);
    setRollNumber('');
    setName('');
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
      <TextField
        label="Roll number"
        value={rollNumber}
        maxLength={studentLimits.maxRollNumberLength}
        autoComplete="off"
        onChange={(event) => {
          setRollNumber(event.target.value);
          setErrors((current) => ({ ...current, rollNumber: undefined }));
        }}
        errorMessage={errors.rollNumber}
      />
      <TextField
        label="Name"
        value={name}
        maxLength={studentLimits.maxNameLength}
        autoComplete="off"
        onChange={(event) => {
          setName(event.target.value);
          setErrors((current) => ({ ...current, name: undefined }));
        }}
        errorMessage={errors.name}
      />
      {addStudents.error && <FormError>{addStudents.error.message}</FormError>}
      <div className={styles.actions}>
        <Button type="submit" disabled={addStudents.isPending}>
          {addStudents.isPending ? 'Adding…' : 'Add student'}
        </Button>
      </div>
    </form>
  );
}
