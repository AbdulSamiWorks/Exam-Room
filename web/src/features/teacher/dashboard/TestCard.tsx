import type { TestSummary } from '@exam-room/shared';
import { Link } from 'react-router';
import { describeDuration, describePaperSize } from '../../../lib/describe-test-length';
import { classNames } from '../../../lib/class-names';
import {
  describeAllowedExits,
  describeChapters,
  describeCreatedDate,
  describeTestKind,
} from '../tests/describe-test';
import { averagePercentOf, describeTestProgress, describeTestStage } from '../tests/test-stage';
import styles from './TestCard.module.css';

export function TestCard({ test }: { test: TestSummary }) {
  const isAssignment = test.kind === 'assignment';
  const testDetails = [
    describeTestKind(test.kind),
    describePaperSize(test),
    isAssignment ? 'No timer' : describeDuration(test.durationMinutes),
    isAssignment ? undefined : describeAllowedExits(test.allowedExits),
  ]
    .filter(Boolean)
    .join(' · ');
  const chapters = describeChapters(test.chapters);
  const status = describeTestStage(test);
  const averagePercent = averagePercentOf(test);

  return (
    <Link
      to={`/teacher/tests/${test.id}`}
      className={classNames(styles.card, styles[status.stage])}
    >
      <span className={styles.titleRow}>
        <span className={styles.title}>{test.title}</span>
        <span className={classNames(styles.stageBadge, styles[`${status.stage}Badge`])}>
          {status.label}
        </span>
      </span>
      <span className={styles.details}>{testDetails}</span>
      {chapters && <span className={styles.details}>{chapters}</span>}
      <span className={styles.footerRow}>
        <span className={styles.progress}>{describeTestProgress(test)}</span>
        {averagePercent !== null && (
          <span className={styles.average}>Average {averagePercent}%</span>
        )}
      </span>
      <span className={styles.meta}>
        <span className={styles.code}>{test.code}</span> · {describeCreatedDate(test.createdAt)}
      </span>
    </Link>
  );
}
