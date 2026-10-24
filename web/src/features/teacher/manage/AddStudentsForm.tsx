import type { StudentWithPin } from '@exam-room/shared';
import { useState } from 'react';
import { ChoiceGroup, type Choice } from '../../../components/ChoiceGroup';
import { OneStudentForm } from './OneStudentForm';
import { StudentListForm } from './StudentListForm';

type EntryMode = 'one' | 'list';

const ENTRY_MODE_CHOICES: Choice<EntryMode>[] = [
  { value: 'one', label: 'One student' },
  { value: 'list', label: 'Paste a list' },
];

export type AddStudentsFormProps = {
  classId: number;
  onAdded: (studentsWithPins: StudentWithPin[]) => void;
};

export function AddStudentsForm({ classId, onAdded }: AddStudentsFormProps) {
  const [entryMode, setEntryMode] = useState<EntryMode>('one');

  return (
    <>
      <ChoiceGroup
        label="How do you want to add them?"
        choices={ENTRY_MODE_CHOICES}
        selectedValue={entryMode}
        onChange={setEntryMode}
      />
      {entryMode === 'one' ? (
        <OneStudentForm classId={classId} onAdded={onAdded} />
      ) : (
        <StudentListForm classId={classId} onAdded={onAdded} />
      )}
    </>
  );
}
