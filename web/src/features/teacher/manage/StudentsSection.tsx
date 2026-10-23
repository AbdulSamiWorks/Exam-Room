import type { ClassSummary, Student, StudentWithPin } from '@exam-room/shared';
import { useState } from 'react';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { Panel } from '../../../components/Panel';
import { countOf } from '../../../lib/text';
import { AddStudentsForm } from './AddStudentsForm';
import { ChoiceForm } from './ChoiceForm';
import { NewPinsPanel } from './NewPinsPanel';
import { StudentRow } from './StudentRow';
import { useMoveStudents, useStudents } from './use-students';
import sectionStyles from './ManageSection.module.css';
import styles from './StudentsSection.module.css';

type StudentsSectionProps = {
  schoolClass: ClassSummary;
  classes: ClassSummary[];
};

export function StudentsSection({ schoolClass, classes }: StudentsSectionProps) {
  const studentsQuery = useStudents(schoolClass.id);
  const [newPins, setNewPins] = useState<StudentWithPin[]>();
  const otherClasses = classes.filter((candidate) => candidate.id !== schoolClass.id);
  const students = studentsQuery.data ?? [];

  return (
    <div className={sectionStyles.section}>
      {newPins && (
        <NewPinsPanel
          schoolClassName={schoolClass.name}
          studentsWithPins={newPins}
          onDone={() => setNewPins(undefined)}
        />
      )}

      <Panel title="Add students">
        <AddStudentsForm classId={schoolClass.id} onAdded={setNewPins} />
      </Panel>

      <Panel title={`Students of ${schoolClass.name}`}>
        {studentsQuery.isPending && <p className={styles.note}>Loading students…</p>}
        {studentsQuery.isError && <FormError>{studentsQuery.error.message}</FormError>}
        {studentsQuery.isSuccess && students.length === 0 && (
          <p className={styles.note}>No students yet. Add them above.</p>
        )}
        {students.length > 0 && (
          <ul className={styles.studentList}>
            {students.map((student) => (
              <StudentRow
                key={student.id}
                student={student}
                classes={classes}
                onPinReset={(studentWithPin) => setNewPins([studentWithPin])}
              />
            ))}
          </ul>
        )}
      </Panel>

      {students.length > 0 && otherClasses.length > 0 && (
        <MoveAllStudentsPanel
          schoolClass={schoolClass}
          students={students}
          otherClasses={otherClasses}
        />
      )}
    </div>
  );
}

type MoveAllStudentsPanelProps = {
  schoolClass: ClassSummary;
  students: Student[];
  otherClasses: ClassSummary[];
};

function MoveAllStudentsPanel({ schoolClass, students, otherClasses }: MoveAllStudentsPanelProps) {
  const [isChoosing, setIsChoosing] = useState(false);
  const moveStudents = useMoveStudents(schoolClass.id);

  return (
    <Panel title="Move all students">
      {isChoosing ? (
        <ChoiceForm
          label="Move them to"
          hint={`All ${countOf(students.length, 'student')} of ${schoolClass.name} move. Their PINs and old results stay.`}
          placeholder="Choose a class"
          choices={otherClasses.map((target) => ({ value: target.id, label: target.name }))}
          submitLabel="Move students"
          busyLabel="Moving…"
          onSubmit={async (toClassId) => {
            await moveStudents.mutateAsync(toClassId);
            setIsChoosing(false);
          }}
          onCancel={() => setIsChoosing(false)}
        />
      ) : (
        <>
          <p className={styles.note}>
            For example at the start of a new school year. Subjects and tests stay in{' '}
            {schoolClass.name}.
          </p>
          <Button variant="secondary" onClick={() => setIsChoosing(true)}>
            Move all students
          </Button>
        </>
      )}
    </Panel>
  );
}
