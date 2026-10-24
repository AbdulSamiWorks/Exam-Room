import type { MultipleChoiceSummary } from './result-summary';
import styles from './MultipleChoiceCounts.module.css';

export function MultipleChoiceCounts({ summary }: { summary: MultipleChoiceSummary }) {
  if (summary.right + summary.wrong + summary.unanswered === 0) return null;
  return (
    <ul className={styles.counts}>
      <li className={styles.right}>{summary.right} right</li>
      <li className={styles.wrong}>{summary.wrong} wrong</li>
      {summary.unanswered > 0 && (
        <li className={styles.unanswered}>{summary.unanswered} not answered</li>
      )}
    </ul>
  );
}
