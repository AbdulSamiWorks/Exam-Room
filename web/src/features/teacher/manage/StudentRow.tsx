import type { ClassSummary, Student, StudentWithPin } from '@exam-room/shared';
import { useState } from 'react';
import { Button } from '../../../components/Button';
import { useConfirmation } from '../../../components/use-confirmation';
import { StudentEditForm } from './StudentEditForm';
import { useDeleteStudent, useResetPin } from './use-students';
import styles from './StudentsSection.module.css';

type StudentRowProps = {
  student: Student;
  classes: ClassSummary[];
  onPinReset: (studentWithPin: StudentWithPin) => void;
};

export function StudentRow({ student, classes, onPinReset }: StudentRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const resetPin = useResetPin(student.id);
  const deleteStudent = useDeleteStudent(student.id);
  const { askToConfirm, confirmationDialog } = useConfirmation();

  function confirmResetPin() {
    askToConfirm({
      title: `Reset the PIN of ${student.name}?`,
      message:
        'The old PIN stops working and every phone logged in with it is logged out. You see the new PIN once.',
      confirmLabel: 'Reset PIN',
      busyLabel: 'Resetting…',
      onConfirm: async () => onPinReset(await resetPin.mutateAsync()),
    });
  }

  function confirmDelete() {
    askToConfirm({
      title: `Delete ${student.name}?`,
      message:
        'The student can no longer log in. Old results stay in each test under the name and roll number. This cannot be undone.',
      confirmLabel: 'Delete student',
      busyLabel: 'Deleting…',
      onConfirm: () => deleteStudent.mutateAsync(),
    });
  }

  if (isEditing) {
    return (
      <li className={styles.editingRow}>
        <StudentEditForm student={student} classes={classes} onDone={() => setIsEditing(false)} />
      </li>
    );
  }

  return (
    <li className={styles.studentRow}>
      <span className={styles.rollNumber}>{student.rollNumber}</span>
      <span className={styles.studentName}>{student.name}</span>
      <span className={styles.studentActions}>
        <Button variant="secondary" size="small" onClick={() => setIsEditing(true)}>
          Edit
        </Button>
        <Button variant="secondary" size="small" onClick={confirmResetPin}>
          Reset PIN
        </Button>
        <Button variant="secondary" size="small" onClick={confirmDelete}>
          Delete
        </Button>
      </span>
      {confirmationDialog}
    </li>
  );
}
