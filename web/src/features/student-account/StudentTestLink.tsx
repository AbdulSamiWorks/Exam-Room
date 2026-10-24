import type { StudentTestCard } from '@exam-room/shared';
import { Link } from 'react-router';
import { useConfirmation } from '../../components/use-confirmation';
import { classNames } from '../../lib/class-names';
import { describeBounty } from '../../lib/describe-bounty';
import { describeDateTime } from '../../lib/describe-date-time';
import { describeDuration } from '../../lib/describe-test-length';
import { describeChapterNames, describeTestKind } from '../../lib/describe-test-kind';
import {
  isComingUp,
  notOpenNotice,
  studentTestPath,
  studentTestPill,
  type StudentTestPill,
} from './group-student-tests';
import styles from './StudentTestLink.module.css';

export function StudentTestList({ tests }: { tests: StudentTestCard[] }) {
  const { showNotice, confirmationDialog } = useConfirmation();

  return (
    <>
      <ul className={styles.testList}>
        {tests.map((test) => (
          <li key={test.code}>
            <StudentTestLink test={test} onNotOpen={() => showNotice(notOpenNotice(test))} />
          </li>
        ))}
      </ul>
      {confirmationDialog}
    </>
  );
}

function describeTiming(test: StudentTestCard): string {
  if (test.availability === 'scheduled') return `Opens ${describeDateTime(test.opensAt)}`;
  if (test.availability === 'not_open') return 'Not open yet. Your teacher opens it.';
  if (test.kind !== 'assignment') return describeDuration(test.durationMinutes);
  return test.closesAt === null ? 'No timer' : `Due ${describeDateTime(test.closesAt)}`;
}

type StudentTestLinkProps = {
  test: StudentTestCard;
  onNotOpen: () => void;
};

function StudentTestLink({ test, onNotOpen }: StudentTestLinkProps) {
  const pill = studentTestPill(test);
  const cardClassName = classNames(styles.testCard, styles[pill.tone]);

  if (isComingUp(test)) {
    return (
      <button type="button" className={cardClassName} onClick={onNotOpen}>
        <StudentTestCardContent test={test} pill={pill} />
      </button>
    );
  }

  return (
    <Link to={studentTestPath(test)} className={cardClassName}>
      <StudentTestCardContent test={test} pill={pill} />
    </Link>
  );
}

function StudentTestCardContent({ test, pill }: { test: StudentTestCard; pill: StudentTestPill }) {
  const bounty = describeBounty(test.bountyNote, test.bountyPoints);
  const chapters = describeChapterNames(test.chapterNames);

  return (
    <>
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
    </>
  );
}
