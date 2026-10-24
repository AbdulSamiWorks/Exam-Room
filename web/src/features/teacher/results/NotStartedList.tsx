import type { NotStartedStudent } from '@exam-room/shared';
import styles from './ResultsPanel.module.css';

export function NotStartedList({ students }: { students: NotStartedStudent[] }) {
  if (students.length === 0) return null;

  return (
    <details className={styles.notStarted}>
      <summary>Not started yet ({students.length})</summary>
      <ul className={styles.notStartedList}>
        {students.map((student) => (
          <li key={student.studentId}>
            <span className={styles.notStartedRoll}>{student.rollNumber}</span> {student.name}
          </li>
        ))}
      </ul>
    </details>
  );
}
