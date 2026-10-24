import type { StudentTestCard } from '@exam-room/shared';
import { Link } from 'react-router';
import { classNames } from '../../lib/class-names';
import { describeBounty } from '../../lib/describe-bounty';
import { describeDateTime } from '../../lib/describe-date-time';
import { describeDuration } from '../../lib/describe-test-length';
import { describeChapterNames, describeTestKind } from '../../lib/describe-test-kind';
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
  if (test.availability === 'not_open') return 'Not open yet. Your teacher opens it.';
  if (test.kind !== 'assignment') return describeDuration(test.durationMinutes);
  return test.closesAt === null ? 'No timer' : `Due ${describeDateTime(test.closesAt)}`;
}

function isComingUp(test: StudentTestCard): boolean {
  return test.attemptStatus === null && ['scheduled', 'not_open'].includes(test.availability);
}

function StudentTestLink({ test }: { test: StudentTestCard }) {
  const bounty = describeBounty(test.bountyNote, test.bountyPoints);
  const chapters = describeChapterNames(test.chapterNames);
  const pill = studentTestPill(test);

  return (
    <Link to={studentTestPath(test)} className={classNames(styles.testCard, styles[pill.tone])}>
      <span className={styles.testText}>
        <span className={styles.testTitle}>{test.title}</span>
        <span className={styles.testDetails}>
          {describeTestKind(test.kind)} · {test.subjectName}
          {!isComingUp(test) && ` · ${describeTiming(test)}`}
        </span>
        {chapters && <span className={styles.chapters}>{chapters}</span>}
        {isComingUp(test) && <span className={styles.timing}>{describeTiming(test)}</span>}
        {bounty && <span className={styles.bounty}>{bounty}</span>}
      </span>
      <span className={classNames(styles.pill, styles[`${pill.tone}Pill`])}>{pill.label}</span>
    </Link>
  );
}
