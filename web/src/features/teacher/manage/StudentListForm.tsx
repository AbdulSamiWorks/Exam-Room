import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { TextAreaField } from '../../../components/TextAreaField';
import { countOf } from '../../../lib/text';
import type { AddStudentsFormProps } from './AddStudentsForm';
import { describeProblem, parseStudentList, type ParsedStudentList } from './student-list-parser';
import { useAddStudents } from './use-students';
import formStyles from './InlineForm.module.css';
import styles from './StudentsSection.module.css';

const LIST_HINT =
  'One student per line: the roll number, then the name. For example: 1, Ayesha Khan';

export function StudentListForm({ classId, onAdded }: AddStudentsFormProps) {
  const addStudents = useAddStudents(classId);
  const [text, setText] = useState('');
  const parsedList = useMemo(() => parseStudentList(text), [text]);
  const studentCount = parsedList.students.length;
  const canAdd = studentCount > 0 && parsedList.problems.length === 0;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canAdd) return;
    const response = await addStudents.mutateAsync(parsedList.students).catch(() => undefined);
    if (!response) return;
    onAdded(response.students);
    setText('');
  }

  return (
    <form className={formStyles.form} onSubmit={(event) => void submit(event)} noValidate>
      <TextAreaField
        label="Student list"
        hint={LIST_HINT}
        value={text}
        placeholder={'1, Ayesha Khan\n2, Bilal Ahmed'}
        spellCheck={false}
        onChange={(event) => setText(event.target.value)}
      />
      {text.trim() && <ListPreview parsedList={parsedList} />}
      {addStudents.error && <FormError>{addStudents.error.message}</FormError>}
      <div className={formStyles.actions}>
        <Button type="submit" disabled={!canAdd || addStudents.isPending}>
          {addStudents.isPending
            ? 'Adding…'
            : `Add ${studentCount > 0 ? countOf(studentCount, 'student') : 'students'}`}
        </Button>
      </div>
    </form>
  );
}

function ListPreview({ parsedList }: { parsedList: ParsedStudentList }) {
  const { students, problems } = parsedList;

  return (
    <div className={styles.preview}>
      {problems.length > 0 && (
        <div className={styles.problems} role="alert">
          <p className={styles.problemsTitle}>Fix these lines first:</p>
          <ul>
            {problems.map((problem) => (
              <li key={`${problem.lineNumber}-${problem.message}`}>{describeProblem(problem)}</li>
            ))}
          </ul>
        </div>
      )}
      {students.length > 0 && (
        <>
          <p className={styles.note}>Ready to add: {countOf(students.length, 'student')}</p>
          <ul className={styles.previewList}>
            {students.map((student) => (
              <li key={student.rollNumber} className={styles.previewRow}>
                <span className={styles.rollNumber}>{student.rollNumber}</span>
                <span className={styles.studentName}>{student.name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
