import type { TestSummary } from '@exam-room/shared';
import { Link } from 'react-router';
import {
  describeAllowedExits,
  describeCreatedDate,
  describeDuration,
  describePageCount,
  describeStudentCount,
} from '../tests/describe-test';
import styles from './TestCard.module.css';

export function TestCard({ test }: { test: TestSummary }) {
  const testDetails = [
    describePageCount(test.pageCount),
    describeDuration(test.durationMinutes),
    describeAllowedExits(test.allowedExits),
  ].join(' · ');
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
      <span className={styles.details}>{activity}</span>
    </Link>
  );
}
