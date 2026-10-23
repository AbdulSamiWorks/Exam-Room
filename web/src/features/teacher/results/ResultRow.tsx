import type { AttemptExit, AttemptResult } from '@exam-room/shared';
import { Link } from 'react-router';
import { Button } from '../../../components/Button';
import { classNames } from '../../../lib/class-names';
import {
  describeAwayTime,
  describeClockTime,
  describeExitPeriod,
  describeExitReason,
  describeExits,
  describeResultStatus,
  isStoppedForLeaving,
} from './describe-result';
import styles from './ResultsPanel.module.css';

export type ResultRowActions = {
  isUnlocking: boolean;
  onUnlock: () => void;
  onEnd: () => void;
  onRemove: () => void;
};

export function ResultRow({
  result,
  questionCount,
  actions,
}: {
  result: AttemptResult;
  questionCount: number;
  actions: ResultRowActions;
}) {
  const status = describeResultStatus(result);
  const isLocked = result.status === 'locked';
  const isWriting = result.status === 'in_progress';

  return (
    <li className={classNames(styles.row, isStoppedForLeaving(result) && styles.lockedRow)}>
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
        {questionCount > 0 && (
          <Fact label="Answered" value={`${result.answeredCount} of ${questionCount}`} />
        )}
        {result.photoCount > 0 && <Fact label="Photos" value={String(result.photoCount)} />}
        {result.totalMarks !== null && <Fact label="Marks" value={String(result.totalMarks)} />}
      </dl>
      {result.exits.length > 0 && <ExitHistory exits={result.exits} />}
      {result.photoCount > 0 && (
        <Link
          to={`/teacher/attempts/${result.id}/photos`}
          state={{ studentName: result.studentName, backTo: window.location.pathname }}
          className={styles.photoLink}
        >
          See the answer photos
        </Link>
      )}
      <div className={styles.rowActions}>
        {isLocked && (
          <Button variant="danger" onClick={actions.onUnlock} disabled={actions.isUnlocking}>
            {actions.isUnlocking ? 'Unlocking…' : 'Unlock'}
          </Button>
        )}
        {isWriting && (
          <Button variant="secondary" onClick={actions.onEnd}>
            End test
          </Button>
        )}
        <Button variant="secondary" onClick={actions.onRemove}>
          Remove
        </Button>
      </div>
    </li>
  );
}

function ExitHistory({ exits }: { exits: AttemptExit[] }) {
  return (
    <details className={styles.exitHistory}>
      <summary>Exit history ({exits.length})</summary>
      <ol className={styles.exitList}>
        {exits.map((exit) => (
          <li key={exit.leftAt} className={styles.exitItem}>
            <span>{describeExitPeriod(exit)}</span>
            <span className={styles.exitDetails}>
              {describeExitReason(exit.reason)} · {describeAwayTime(exit.awayMs)}
            </span>
          </li>
        ))}
      </ol>
    </details>
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
