import type { TestSummary } from '@exam-room/shared';
import { Link } from 'react-router';
import { describeDuration, describePageCount } from '../../../lib/describe-test-length';
import { AvailabilityBadge } from '../tests/AvailabilityBadge';
import {
  describeAllowedExits,
  describeChapters,
  describeCreatedDate,
  describeStudentCount,
  describeTestKind,
} from '../tests/describe-test';
import styles from './TestCard.module.css';

export function TestCard({ test }: { test: TestSummary }) {
  const testDetails = [
    describeTestKind(test.kind),
    describePageCount(test.pageCount),
    describeDuration(test.durationMinutes),
    describeAllowedExits(test.allowedExits),
  ].join(' · ');
  const chapters = describeChapters(test.chapters);
  const activity = [
    describeStudentCount(test.studentCount),
    describeCreatedDate(test.createdAt),
  ].join(' · ');

  return (
    <Link to={`/teacher/tests/${test.id}`} className={styles.card}>
      <span className={styles.titleRow}>
        <span className={styles.title}>{test.title}</span>
        <span className={styles.code}>{test.code}</span>
      </span>
      <span className={styles.details}>{testDetails}</span>
      {chapters && <span className={styles.details}>{chapters}</span>}
      <span className={styles.footerRow}>
        <span className={styles.details}>{activity}</span>
        <AvailabilityBadge test={test} />
      </span>
    </Link>
  );
}
