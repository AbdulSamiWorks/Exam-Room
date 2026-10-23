import type { ClassSubjectSummary, ClassSummary } from '@exam-room/shared';
import { useState } from 'react';
import { Button } from '../../../components/Button';
import { useConfirmation } from '../../../components/use-confirmation';
import { countOf } from '../../../lib/text';
import { ChapterList } from './ChapterList';
import { ChoiceForm } from './ChoiceForm';
import { subjectLimits } from './manage-limits';
import { describeSubjectDeletion, subjectDeletionBlocker } from './manage-rules';
import { NameForm } from './NameForm';
import { otherSubjectOptions } from './subject-options';
import { useDeleteSubject, useMoveSubjectTests, useUpdateSubject } from './use-classes';
import styles from './SubjectCard.module.css';

type SubjectCardProps = {
  subject: ClassSubjectSummary;
  schoolClass: ClassSummary;
  classes: ClassSummary[];
};

type SubjectAction = 'rename' | 'moveToClass' | 'moveTests';

export function SubjectCard({ subject, schoolClass, classes }: SubjectCardProps) {
  const [openAction, setOpenAction] = useState<SubjectAction>();
  const updateSubject = useUpdateSubject(subject.id);
  const moveTests = useMoveSubjectTests(subject.id);
  const deleteSubject = useDeleteSubject(subject.id);
  const { askToConfirm, showNotice, confirmationDialog } = useConfirmation();
  const closeAction = () => setOpenAction(undefined);

  const otherClassChoices = classes
    .filter((candidate) => candidate.id !== schoolClass.id)
    .map((candidate) => ({ value: candidate.id, label: candidate.name }));
  const testTargetChoices = otherSubjectOptions(classes, subject.id).map((option) => ({
    value: option.subjectId,
    label: option.label,
  }));

  function confirmDelete() {
    const blocker = subjectDeletionBlocker(subject);
    if (blocker) {
      showNotice({ title: `${subject.name} cannot be deleted yet`, message: blocker });
      return;
    }
    askToConfirm({
      title: 'Delete subject?',
      message: describeSubjectDeletion(subject),
      confirmLabel: 'Delete subject',
      busyLabel: 'Deleting…',
      onConfirm: () => deleteSubject.mutateAsync(),
    });
  }

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <h3 className={styles.name}>{subject.name}</h3>
        <p className={styles.details}>
          {countOf(subject.testCount, 'test')} · {countOf(subject.chapters.length, 'chapter')}
        </p>
      </header>

      {openAction === 'rename' && (
        <NameForm
          label="Subject name"
          initialName={subject.name}
          maxLength={subjectLimits.maxNameLength}
          submitLabel="Save"
          busyLabel="Saving…"
          autoFocus
          onSubmit={async (name) => {
            await updateSubject.mutateAsync({ name });
            closeAction();
          }}
          onCancel={closeAction}
        />
      )}

      {openAction === 'moveToClass' && (
        <ChoiceForm
          label="Move to class"
          hint={`${subject.name} moves with its chapters and ${countOf(subject.testCount, 'test')}.`}
          placeholder="Choose a class"
          choices={otherClassChoices}
          submitLabel="Move subject"
          busyLabel="Moving…"
          onSubmit={(classId) => updateSubject.mutateAsync({ classId })}
          onCancel={closeAction}
        />
      )}

      {openAction === 'moveTests' && (
        <ChoiceForm
          label="Move its tests to"
          hint="All tests of this subject move. Their chapter tags are removed."
          placeholder="Choose a subject"
          choices={testTargetChoices}
          submitLabel="Move tests"
          busyLabel="Moving…"
          onSubmit={async (toSubjectId) => {
            await moveTests.mutateAsync(toSubjectId);
            closeAction();
          }}
          onCancel={closeAction}
        />
      )}

      {openAction === undefined && (
        <div className={styles.actions}>
          <Button variant="secondary" size="small" onClick={() => setOpenAction('rename')}>
            Rename
          </Button>
          {otherClassChoices.length > 0 && (
            <Button variant="secondary" size="small" onClick={() => setOpenAction('moveToClass')}>
              Move to class
            </Button>
          )}
          {subject.testCount > 0 && testTargetChoices.length > 0 && (
            <Button variant="secondary" size="small" onClick={() => setOpenAction('moveTests')}>
              Move its tests
            </Button>
          )}
          <Button variant="secondary" size="small" onClick={confirmDelete}>
            Delete
          </Button>
        </div>
      )}

      <ChapterList subject={subject} />
      {confirmationDialog}
    </article>
  );
}
