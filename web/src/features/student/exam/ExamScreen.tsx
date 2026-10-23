import type { StudentAttempt } from '@exam-room/shared';
import { useEffect, useState, type SyntheticEvent } from 'react';
import { Button } from '../../../components/Button';
import { classNames } from '../../../lib/class-names';
import { useFinishAttempt } from '../use-attempt';
import { FinishDialog } from './FinishDialog';
import { PaperViewer } from './PaperViewer';
import { TypedPaperViewer } from './TypedPaperViewer';
import { formatRemainingTime, useRemainingTime } from './use-remaining-time';
import styles from './ExamScreen.module.css';

const LAST_MINUTES_MS = 5 * 60 * 1000;
const TIME_UP_CHECK_INTERVAL_MS = 2000;

type ExamScreenProps = {
  testCode: string;
  attemptToken: string;
  attempt: StudentAttempt;
  onTimeUp: () => void;
};

export function ExamScreen({ testCode, attemptToken, attempt, onTimeUp }: ExamScreenProps) {
  const remainingMs = useRemainingTime(attempt.deadlineAt, attempt.serverTime);
  const isTimeUp = remainingMs === 0;
  const finishAttempt = useFinishAttempt(testCode, attemptToken);
  const [isFinishDialogOpen, setIsFinishDialogOpen] = useState(false);

  useEffect(() => {
    if (!isTimeUp) return;
    onTimeUp();
    const timer = window.setInterval(onTimeUp, TIME_UP_CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isTimeUp, onTimeUp]);

  return (
    <div
      className={styles.examScreen}
      onContextMenu={preventDefault}
      onCopy={preventDefault}
      onCut={preventDefault}
      onDragStart={preventDefault}
    >
      <header className={styles.topBar}>
        <div className={styles.headings}>
          <span className={styles.title}>{attempt.test.title}</span>
          <span className={styles.student}>
            {attempt.studentName} · {attempt.rollNumber}
          </span>
        </div>
        <span
          className={classNames(styles.timer, remainingMs <= LAST_MINUTES_MS && styles.timerEnding)}
          role="timer"
          aria-label="Time left"
        >
          {formatRemainingTime(remainingMs)}
        </span>
        <Button onClick={() => setIsFinishDialogOpen(true)}>Finish</Button>
      </header>

      {attempt.test.paperKind === 'typed' ? (
        <TypedPaperViewer testCode={testCode} attemptToken={attemptToken} />
      ) : (
        <PaperViewer
          testCode={testCode}
          attemptToken={attemptToken}
          pageSizes={attempt.pageSizes}
        />
      )}

      {isFinishDialogOpen && (
        <FinishDialog
          isFinishing={finishAttempt.isPending}
          errorMessage={finishAttempt.error?.message}
          onCancel={() => setIsFinishDialogOpen(false)}
          onConfirm={() => finishAttempt.mutate()}
        />
      )}
    </div>
  );
}

function preventDefault(event: SyntheticEvent): void {
  event.preventDefault();
}
