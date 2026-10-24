import type { StudentTestCard } from '@exam-room/shared';
import { Link } from 'react-router';
import { describeBounty } from '../../lib/describe-bounty';
import { describeDateTime } from '../../lib/describe-date-time';
import { describeDuration } from '../../lib/describe-test-length';
import { classNames } from '../../lib/class-names';
import { describeStudentTestState, studentTestPath, studentTestTone } from './group-student-tests';
import styles from './StudentHomePage.module.css';

export function StudentTestList({ tests }: { tests: StudentTestCard[] }) {
  return (
    <ul className={styles.testList}>
      {tests.map((test) => (
        <li key={test.code}>
          <StudentTestLink test={test} />
        </li>
      ))}
    </ul>
  );
}

function describeLength(test: StudentTestCard): string {
  if (test.kind !== 'assignment') return describeDuration(test.durationMinutes);
  return test.closesAt === null ? 'No timer' : `Due ${describeDateTime(test.closesAt)}`;
}

function StudentTestLink({ test }: { test: StudentTestCard }) {
  const bounty = describeBounty(test.bountyNote, test.bountyPoints);
  const timing =
    test.availability === 'scheduled'
      ? `Opens ${describeDateTime(test.opensAt)}`
      : describeLength(test);

  return (
    <Link to={studentTestPath(test)} className={styles.testCard}>
      <span className={styles.testTitle}>{test.title}</span>
      <span className={styles.testDetails}>
        {test.subjectName} · {timing}
      </span>
      <span className={classNames(styles.testState, styles[studentTestTone(test)])}>
        {describeStudentTestState(test)}
      </span>
      {bounty && <span className={styles.testDetails}>{bounty}</span>}
    </Link>
  );
}
