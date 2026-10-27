import type { AnswerSummary } from './result-summary';
import styles from './AnswerCounts.module.css';

export function AnswerCounts({ summary }: { summary: AnswerSummary }) {
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
