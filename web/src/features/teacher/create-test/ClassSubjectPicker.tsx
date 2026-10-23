import type { ClassSummary } from '@exam-room/shared';
import { useState, type KeyboardEvent } from 'react';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { SelectField } from '../../../components/SelectField';
import { TextField } from '../../../components/TextField';
import { useCreateSubject } from '../manage/use-classes';
import { subjectLimits } from '../manage/manage-limits';
import styles from './ClassSubjectPicker.module.css';

type ClassSubjectPickerProps = {
  classes: ClassSummary[];
  classId: string;
  subjectId: string;
  onSelectClass: (classId: string) => void;
  onSelectSubject: (subjectId: string) => void;
  errorMessage?: string;
};

export function ClassSubjectPicker({
  classes,
  classId,
  subjectId,
  onSelectClass,
  onSelectSubject,
  errorMessage,
}: ClassSubjectPickerProps) {
  const selectedClass = classes.find((schoolClass) => String(schoolClass.id) === classId);
  const subjects = selectedClass?.subjects ?? [];
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const showAddSubjectForm = selectedClass && (isAddingSubject || subjects.length === 0);

  return (
    <div className={styles.picker}>
      <SelectField
        label="Class"
        value={classId}
        onChange={(event) => {
          setIsAddingSubject(false);
          onSelectClass(event.target.value);
        }}
      >
        <option value="">Choose a class</option>
        {classes.map((schoolClass) => (
          <option key={schoolClass.id} value={schoolClass.id}>
            {schoolClass.name}
          </option>
        ))}
      </SelectField>

      {showAddSubjectForm ? (
        <AddSubjectForm
          classId={selectedClass.id}
          isFirstSubject={subjects.length === 0}
          errorMessage={errorMessage}
          onAdded={(newSubjectId) => {
            onSelectSubject(String(newSubjectId));
            setIsAddingSubject(false);
          }}
          onCancel={() => setIsAddingSubject(false)}
        />
      ) : (
        <div className={styles.chooseSubject}>
          <SelectField
            label="Subject"
            value={subjectId}
            disabled={!selectedClass}
            onChange={(event) => onSelectSubject(event.target.value)}
            errorMessage={errorMessage}
          >
            <option value="">{selectedClass ? 'Choose a subject' : 'Choose a class first'}</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </SelectField>
          {selectedClass && (
            <button
              type="button"
              className={styles.addSubjectLink}
              onClick={() => setIsAddingSubject(true)}
            >
              + Add a new subject
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type AddSubjectFormProps = {
  classId: number;
  isFirstSubject: boolean;
  errorMessage?: string;
  onAdded: (subjectId: number) => void;
  onCancel: () => void;
};

function AddSubjectForm({
  classId,
  isFirstSubject,
  errorMessage,
  onAdded,
  onCancel,
}: AddSubjectFormProps) {
  const createSubject = useCreateSubject(classId);
  const [newSubjectName, setNewSubjectName] = useState('');

  function addSubject() {
    if (!newSubjectName.trim()) return;
    createSubject.mutate(newSubjectName, {
      onSuccess: ({ subject }) => onAdded(subject.id),
    });
  }

  function addSubjectOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addSubject();
  }

  return (
    <div className={styles.addSubject}>
      <TextField
        label={isFirstSubject ? 'Subject' : 'New subject'}
        hint={
          isFirstSubject
            ? 'This class has no subjects yet. Add one, for example Physics.'
            : undefined
        }
        placeholder="e.g. Chemistry"
        value={newSubjectName}
        maxLength={subjectLimits.maxNameLength}
        onChange={(event) => setNewSubjectName(event.target.value)}
        onKeyDown={addSubjectOnEnter}
        errorMessage={errorMessage}
        autoFocus={!isFirstSubject}
      />
      {createSubject.error && <FormError>{createSubject.error.message}</FormError>}
      <div className={styles.actions}>
        <Button onClick={addSubject} disabled={createSubject.isPending || !newSubjectName.trim()}>
          {createSubject.isPending ? 'Adding…' : 'Add subject'}
        </Button>
        {!isFirstSubject && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
