import { useState, type KeyboardEvent } from 'react';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { SelectField } from '../../../components/SelectField';
import { TextField } from '../../../components/TextField';
import { useCreateSubject, useSubjects } from '../subjects/use-subjects';
import styles from './SubjectPicker.module.css';

type SubjectPickerProps = {
  selectedSubjectId: string;
  onSelect: (subjectId: string) => void;
  errorMessage?: string;
};

export function SubjectPicker({ selectedSubjectId, onSelect, errorMessage }: SubjectPickerProps) {
  const subjects = useSubjects();
  const createSubject = useCreateSubject();
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');

  const hasNoSubjects = subjects.isSuccess && subjects.data.length === 0;
  const showAddSubjectForm = isAddingSubject || hasNoSubjects;

  function addSubject() {
    if (!newSubjectName.trim()) return;
    createSubject.mutate(newSubjectName, {
      onSuccess: ({ subject }) => {
        onSelect(String(subject.id));
        setNewSubjectName('');
        setIsAddingSubject(false);
      },
    });
  }

  function addSubjectOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addSubject();
  }

  if (showAddSubjectForm) {
    return (
      <div className={styles.addSubject}>
        <TextField
          label={hasNoSubjects ? 'Subject' : 'New subject'}
          hint={hasNoSubjects ? 'Add your first subject, for example Math or Physics.' : undefined}
          placeholder="e.g. Chemistry"
          value={newSubjectName}
          onChange={(event) => setNewSubjectName(event.target.value)}
          onKeyDown={addSubjectOnEnter}
          errorMessage={errorMessage}
          autoFocus={isAddingSubject}
        />
        {createSubject.error && <FormError>{createSubject.error.message}</FormError>}
        <div className={styles.actions}>
          <Button onClick={addSubject} disabled={createSubject.isPending || !newSubjectName.trim()}>
            {createSubject.isPending ? 'Adding…' : 'Add subject'}
          </Button>
          {!hasNoSubjects && (
            <Button variant="secondary" onClick={() => setIsAddingSubject(false)}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chooseSubject}>
      <SelectField
        label="Subject"
        value={selectedSubjectId}
        onChange={(event) => onSelect(event.target.value)}
        errorMessage={errorMessage ?? subjects.error?.message}
        disabled={subjects.isPending}
      >
        <option value="">{subjects.isPending ? 'Loading subjects…' : 'Choose a subject'}</option>
        {subjects.data?.map((subject) => (
          <option key={subject.id} value={subject.id}>
            {subject.name}
          </option>
        ))}
      </SelectField>
      <button
        type="button"
        className={styles.addSubjectLink}
        onClick={() => setIsAddingSubject(true)}
      >
        + Add a new subject
      </button>
    </div>
  );
}
