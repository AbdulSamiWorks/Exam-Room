import type { ClassSummary } from '@exam-room/shared';
import { Panel } from '../../../components/Panel';
import { subjectLimits } from './manage-limits';
import { NameForm } from './NameForm';
import { SubjectCard } from './SubjectCard';
import { useCreateSubject } from './use-classes';
import styles from './ManageSection.module.css';

type SubjectsSectionProps = {
  schoolClass: ClassSummary;
  classes: ClassSummary[];
};

export function SubjectsSection({ schoolClass, classes }: SubjectsSectionProps) {
  const createSubject = useCreateSubject(schoolClass.id);

  return (
    <div className={styles.section}>
      <Panel title="Add a subject">
        <NameForm
          label="Subject name"
          placeholder="e.g. Physics"
          maxLength={subjectLimits.maxNameLength}
          submitLabel="Add subject"
          busyLabel="Adding…"
          clearsAfterSubmit
          onSubmit={(name) => createSubject.mutateAsync(name)}
        />
      </Panel>

      {schoolClass.subjects.length === 0 ? (
        <p className={styles.emptyMessage}>
          {schoolClass.name} has no subjects yet. Add the first one above.
        </p>
      ) : (
        <ul className={styles.cardList}>
          {schoolClass.subjects.map((subject) => (
            <li key={subject.id}>
              <SubjectCard subject={subject} schoolClass={schoolClass} classes={classes} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
