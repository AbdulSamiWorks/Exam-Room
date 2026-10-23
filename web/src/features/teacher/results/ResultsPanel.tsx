import type { AttemptResult } from '@exam-room/shared';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { Panel } from '../../../components/Panel';
import { classNames } from '../../../lib/class-names';
import {
  describeAwayTime,
  describeClockTime,
  describeExits,
  describeResultStatus,
} from './describe-result';
import { useTestResults, useUnlockAttempt } from './use-results';
import styles from './ResultsPanel.module.css';

export function ResultsPanel({ testId }: { testId: number }) {
  const resultsQuery = useTestResults(testId);
  const unlockAttempt = useUnlockAttempt(testId);

  return (
    <Panel title="Results">
      {resultsQuery.isPending && <p className={styles.note}>Loading results…</p>}
      {resultsQuery.isError && <FormError>{resultsQuery.error.message}</FormError>}
      {unlockAttempt.error && <FormError>{unlockAttempt.error.message}</FormError>}

      {resultsQuery.data && resultsQuery.data.attempts.length === 0 && (
        <p className={styles.note}>Students who start the test will appear here.</p>
      )}

      {resultsQuery.data && resultsQuery.data.attempts.length > 0 && (
        <>
          <ul className={styles.results}>
            {resultsQuery.data.attempts.map((result) => (
              <ResultRow
                key={result.id}
                result={result}
                isUnlocking={unlockAttempt.isPending && unlockAttempt.variables === result.id}
                onUnlock={() => unlockAttempt.mutate(result.id)}
              />
            ))}
          </ul>
          <p className={styles.note}>Updates every 5 seconds.</p>
        </>
      )}
    </Panel>
  );
}

type ResultRowProps = {
  result: AttemptResult;
  isUnlocking: boolean;
  onUnlock: () => void;
};

function ResultRow({ result, isUnlocking, onUnlock }: ResultRowProps) {
  const status = describeResultStatus(result);
  const isLocked = result.status === 'locked';

  return (
    <li className={classNames(styles.row, isLocked && styles.lockedRow)}>
      <div className={styles.rowHeader}>
        <span className={styles.studentName}>{result.studentName}</span>
        <span className={classNames(styles.status, styles[status.tone])}>{status.label}</span>
      </div>
      <dl className={styles.facts}>
        <Fact label="Roll no." value={result.rollNumber} />
        <Fact label="Started" value={describeClockTime(result.startedAt)} />
        <Fact label="Finished" value={describeClockTime(result.finishedAt)} />
        <Fact label="Exits" value={describeExits(result)} />
        <Fact label="Away" value={describeAwayTime(result.awayMs)} />
      </dl>
      {isLocked && (
        <Button variant="danger" onClick={onUnlock} disabled={isUnlocking}>
          {isUnlocking ? 'Unlocking…' : 'Unlock'}
        </Button>
      )}
    </li>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
