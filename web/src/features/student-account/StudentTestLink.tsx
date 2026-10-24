import type { StudentTestCard } from '@exam-room/shared';
import { Link } from 'react-router';
import { classNames } from '../../lib/class-names';
import { describeBounty } from '../../lib/describe-bounty';
import { describeDateTime } from '../../lib/describe-date-time';
import { describeDuration } from '../../lib/describe-test-length';
import { studentTestPath, studentTestPill } from './group-student-tests';
import styles from './StudentTestLink.module.css';

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

function describeTiming(test: StudentTestCard): string {
  if (test.availability === 'scheduled') return `Opens ${describeDateTime(test.opensAt)}`;
  if (test.kind !== 'assignment') return describeDuration(test.durationMinutes);
  return test.closesAt === null ? 'No timer' : `Due ${describeDateTime(test.closesAt)}`;
}

function StudentTestLink({ test }: { test: StudentTestCard }) {
  const bounty = describeBounty(test.bountyNote, test.bountyPoints);
  const pill = studentTestPill(test);

  return (
    <Link to={studentTestPath(test)} className={classNames(styles.testCard, styles[pill.tone])}>
      <span className={styles.testText}>
        <span className={styles.testTitle}>{test.title}</span>
        <span className={styles.testDetails}>
          {test.subjectName} · {describeTiming(test)}
        </span>
        {bounty && <span className={styles.bounty}>{bounty}</span>}
      </span>
      <span className={classNames(styles.pill, styles[`${pill.tone}Pill`])}>{pill.label}</span>
    </Link>
  );
}
