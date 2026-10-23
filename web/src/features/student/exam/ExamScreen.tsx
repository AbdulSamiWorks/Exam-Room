import type { StudentAttempt } from '@exam-room/shared';
import { useEffect, useState, type SyntheticEvent } from 'react';
import { Button } from '../../../components/Button';
import { classNames } from '../../../lib/class-names';
import { AnswerStatus } from '../answers/AnswerStatus';
import { requestFinish, type OutboxSnapshot } from '../answers/outbox-store';
import { useSavedAnswersRestore } from '../answers/use-answer-outbox';
import { ExamBody } from './ExamBody';
import { FinishDialog } from './FinishDialog';
import { formatRemainingTime, useRemainingTime } from './use-remaining-time';
import styles from './ExamScreen.module.css';

const LAST_MINUTES_MS = 5 * 60 * 1000;
const TIME_UP_CHECK_INTERVAL_MS = 2000;

type ExamScreenProps = {
  testCode: string;
  attemptToken: string;
  attempt: StudentAttempt;
  outbox: OutboxSnapshot | undefined;
  onTimeUp: () => void;
};

export function ExamScreen({ testCode, attemptToken, attempt, outbox, onTimeUp }: ExamScreenProps) {
  const remainingMs = useRemainingTime(attempt.deadlineAt, attempt.serverTime);
  const isTimeUp = remainingMs === 0;
  const [isFinishDialogOpen, setIsFinishDialogOpen] = useState(false);
  const hasQuestions = attempt.test.questionCount > 0;
  const isFinishing = outbox?.outbox.finishRequested ?? false;
  useSavedAnswersRestore(testCode, attemptToken, hasQuestions);

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

      {hasQuestions && outbox && <AnswerStatus sendingState={outbox.sendingState} />}

      <ExamBody testCode={testCode} attemptToken={attemptToken} attempt={attempt} outbox={outbox} />

      {(isFinishDialogOpen || isFinishing) && (
        <FinishDialog
          isFinishing={isFinishing}
          isOffline={outbox?.sendingState === 'offline'}
          onCancel={() => setIsFinishDialogOpen(false)}
          onConfirm={() => requestFinish(testCode)}
        />
      )}
    </div>
  );
}

function preventDefault(event: SyntheticEvent): void {
  event.preventDefault();
}
