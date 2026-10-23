import type { ClassSummary } from '@exam-room/shared';
import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { Panel } from '../../../components/Panel';
import { SelectField } from '../../../components/SelectField';
import { TextField } from '../../../components/TextField';
import { useAddPoints, useClassPoints } from './use-points';
import sectionStyles from './ManageSection.module.css';
import styles from './StudentsSection.module.css';

export function PointsSection({ schoolClass }: { schoolClass: ClassSummary }) {
  const pointsQuery = useClassPoints(schoolClass.id);
  const addPoints = useAddPoints(schoolClass.id);
  const [studentId, setStudentId] = useState('');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string>();
  const students = pointsQuery.data ?? [];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pointsNumber = Number(points);
    if (!studentId || !Number.isInteger(pointsNumber) || pointsNumber === 0 || !reason.trim()) {
      setProblem('Choose a student, enter points (like 5 or -2) and a reason.');
      return;
    }
    setProblem(undefined);
    addPoints.mutate(
      { studentId: Number(studentId), change: { points: pointsNumber, reason: reason.trim() } },
      {
        onSuccess: () => {
          setPoints('');
          setReason('');
        },
      },
    );
  }

  return (
    <div className={sectionStyles.section}>
      <Panel title="Give or take points">
        <form className={styles.pointsForm} onSubmit={submit} noValidate>
          <SelectField
            label="Student"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
          >
            <option value="">Choose a student</option>
            {students.map((student) => (
              <option key={student.studentId} value={student.studentId}>
                {student.rollNumber} · {student.name}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Points"
            hint="Use a minus sign to take points away, for example -2."
            inputMode="numeric"
            value={points}
            onChange={(event) => setPoints(event.target.value)}
          />
          <TextField
            label="Reason"
            placeholder="e.g. Helped a classmate"
            maxLength={120}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          {(problem ?? addPoints.error?.message) && (
            <FormError>{problem ?? addPoints.error?.message}</FormError>
          )}
          <Button type="submit" disabled={addPoints.isPending}>
            {addPoints.isPending ? 'Saving…' : 'Save points'}
          </Button>
        </form>
      </Panel>
      <Panel title={`Points of ${schoolClass.name}`}>
        {pointsQuery.isError && <FormError>{pointsQuery.error.message}</FormError>}
        {students.length === 0 && pointsQuery.isSuccess && (
          <p className={styles.note}>No students yet.</p>
        )}
        <ul className={styles.studentList}>
          {[...students]
            .sort((first, second) => second.points - first.points)
            .map((student) => (
              <li key={student.studentId} className={styles.studentRow}>
                <span className={styles.rollNumber}>{student.rollNumber}</span>
                <span className={styles.studentName}>{student.name}</span>
                <span className={styles.pointsValue}>{student.points}</span>
              </li>
            ))}
        </ul>
      </Panel>
    </div>
  );
}
