import type { AttemptResult, TestSummary } from '@exam-room/shared';
import { Button, ButtonLink } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { Panel } from '../../../components/Panel';
import { useConfirmation } from '../../../components/use-confirmation';
import { downloadTextFile } from '../../../lib/download-file';
import { countWaiting } from './describe-result';
import { buildResultsCsv, resultsFileName } from './results-csv';
import { testMarkingPath } from '../tests/test-paths';
import { NotStartedList } from './NotStartedList';
import { ResultRow } from './ResultRow';
import {
  useDeleteAttempt,
  useEndAttempt,
  useEndExamForEveryone,
  useStartEveryone,
  useTestResults,
  useUnlockAttempt,
} from './use-results';
import styles from './ResultsPanel.module.css';

const CSV_MEDIA_TYPE = 'text/csv;charset=utf-8';

export function ResultsPanel({ test }: { test: TestSummary }) {
  const testId = test.id;
  const resultsQuery = useTestResults(testId);
  const unlockAttempt = useUnlockAttempt(testId);
  const endAttempt = useEndAttempt(testId);
  const endExamForEveryone = useEndExamForEveryone(testId);
  const deleteAttempt = useDeleteAttempt(testId);
  const startEveryone = useStartEveryone(testId);
  const { askToConfirm, confirmationDialog } = useConfirmation();

  const attempts = resultsQuery.data?.attempts ?? [];
  const notStarted = resultsQuery.data?.notStarted ?? [];
  const isAnyoneWriting = attempts.some((attempt) => attempt.status === 'in_progress');
  const waitingCount = countWaiting(attempts);

  function downloadCsv() {
    downloadTextFile(
      resultsFileName(test.title),
      buildResultsCsv(attempts, test.maxMarks),
      CSV_MEDIA_TYPE,
    );
  }

  function confirmEnd(attempt: AttemptResult) {
    askToConfirm({
      title: `End ${attempt.studentName}'s test?`,
      message: 'Their paper closes now and the test is submitted.',
      confirmLabel: 'End test',
      busyLabel: 'Ending…',
      onConfirm: () => endAttempt.mutateAsync(attempt.id),
    });
  }

  function confirmRemove(attempt: AttemptResult) {
    askToConfirm({
      title: `Remove ${attempt.studentName}?`,
      message:
        'Their start time and exits are deleted. While the test is open, they can start again with the full time.',
      confirmLabel: 'Remove',
      busyLabel: 'Removing…',
      onConfirm: () => deleteAttempt.mutateAsync(attempt.id),
    });
  }

  function confirmEndForEveryone() {
    askToConfirm({
      title: 'End the exam for everyone?',
      message:
        'Every student who is still writing or waiting is submitted now, and the test is closed so nobody new can start.',
      confirmLabel: 'End exam',
      busyLabel: 'Ending…',
      onConfirm: () => endExamForEveryone.mutateAsync(),
    });
  }

  return (
    <Panel title="Results">
      {resultsQuery.isPending && <p className={styles.note}>Loading results…</p>}
      {resultsQuery.isError && <FormError>{resultsQuery.error.message}</FormError>}
      {unlockAttempt.error && <FormError>{unlockAttempt.error.message}</FormError>}
      {startEveryone.error && <FormError>{startEveryone.error.message}</FormError>}

      {resultsQuery.data && attempts.length === 0 && (
        <p className={styles.note}>Students who start the test will appear here.</p>
      )}
      <NotStartedList students={notStarted} />

      {attempts.length > 0 && (
        <>
          {waitingCount > 0 && (
            <Button
              size="large"
              onClick={() => startEveryone.mutate()}
              disabled={startEveryone.isPending}
            >
              {startEveryone.isPending
                ? 'Starting…'
                : `Start for everyone (${waitingCount} waiting)`}
            </Button>
          )}
          {(isAnyoneWriting || waitingCount > 0) && (
            <Button variant="danger" onClick={confirmEndForEveryone}>
              End exam for everyone
            </Button>
          )}
          <ul className={styles.results}>
            {attempts.map((attempt) => (
              <ResultRow
                key={attempt.id}
                result={attempt}
                answerCount={test.answerCount}
                markingPath={
                  test.questionCount > 0 ? testMarkingPath(testId, attempt.id) : undefined
                }
                actions={{
                  isUnlocking: unlockAttempt.isPending && unlockAttempt.variables === attempt.id,
                  onUnlock: () => unlockAttempt.mutate(attempt.id),
                  onEnd: () => confirmEnd(attempt),
                  onRemove: () => confirmRemove(attempt),
                }}
              />
            ))}
          </ul>
          <p className={styles.note}>Updates every 5 seconds.</p>
          <div className={styles.exportActions}>
            <Button variant="secondary" onClick={downloadCsv}>
              Download CSV
            </Button>
            <ButtonLink variant="secondary" to={`/teacher/tests/${testId}/print`}>
              Print
            </ButtonLink>
          </div>
        </>
      )}

      {confirmationDialog}
    </Panel>
  );
}
