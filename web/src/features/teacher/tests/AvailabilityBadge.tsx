import type { TestSummary } from '@exam-room/shared';
import { classNames } from '../../../lib/class-names';
import { describeAvailabilityStatus } from './describe-availability';
import styles from './AvailabilityBadge.module.css';

export function AvailabilityBadge({ test }: { test: TestSummary }) {
  const status = describeAvailabilityStatus(test);
  return <span className={classNames(styles.badge, styles[status.tone])}>{status.label}</span>;
}
