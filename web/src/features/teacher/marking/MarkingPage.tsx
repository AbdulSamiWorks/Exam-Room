import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { FormError } from '../../../components/FormError';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Page } from '../../../components/Page';
import { classNames } from '../../../lib/class-names';
import { describeScore } from '../../../lib/describe-marks';
import { describeMarkingProgress } from './marking-summary';
import { ReleasePanel } from './ReleasePanel';
import { StudentMarkingForm } from './StudentMarkingForm';
import { useMarking } from './use-marking';
import styles from './MarkingPage.module.css';

function studentElementId(attemptId: number): string {
  return `student-${attemptId}`;
}

export function MarkingPage() {
  const testId = Number(useParams().testId);
  const markingQuery = useMarking(testId);
  const [searchParams] = useSearchParams();
  const [openAttemptId, setOpenAttemptId] = useState<number | undefined>(
    () => Number(searchParams.get('student')) || undefined,
  );
  const backLink = { to: `/teacher/tests/${testId}`, label: 'Back to the test' };
  const isLoaded = markingQuery.isSuccess;

  useEffect(() => {
    if (!isLoaded || openAttemptId === undefined) return;
    document.getElementById(studentElementId(openAttemptId))?.scrollIntoView({ block: 'start' });
  }, [isLoaded, openAttemptId]);

  if (markingQuery.isPending) return <LoadingScreen message="Marking…" />;
  if (markingQuery.isError) {
    return (
      <Page title="Marks" backLink={backLink}>
        <FormError>{markingQuery.error.message}</FormError>
      </Page>
    );
  }

  const marking = markingQuery.data;
  const attemptIds = marking.attempts.map((attempt) => attempt.attemptId);

  function openNext(attemptId: number) {
    const nextAttemptId = attemptIds[attemptIds.indexOf(attemptId) + 1];
    setOpenAttemptId(nextAttemptId);
  }

  return (
    <Page title="Marks" subtitle={`Out of ${marking.maxMarks}`} backLink={backLink}>
      <div className={styles.sections}>
        <ReleasePanel testId={testId} marking={marking} />
        {marking.attempts.length === 0 && <p className={styles.note}>Nobody has started yet.</p>}
        <ul className={styles.studentList}>
          {marking.attempts.map((attempt) => {
            const isOpen = attempt.attemptId === openAttemptId;
            return (
              <li
                key={attempt.attemptId}
                id={studentElementId(attempt.attemptId)}
                className={classNames(styles.student, isOpen && styles.open)}
              >
                <button
                  type="button"
                  className={styles.studentHeader}
                  aria-expanded={isOpen}
                  onClick={() => setOpenAttemptId(isOpen ? undefined : attempt.attemptId)}
                >
                  <span className={styles.studentName}>
                    {attempt.rollNumber} · {attempt.studentName}
                  </span>
                  <span className={styles.score}>
                    {describeScore(attempt.score.totalMarks, marking.maxMarks)}
                  </span>
                  <span className={styles.muted}>{describeMarkingProgress(attempt)}</span>
                </button>
                {isOpen && (
                  <StudentMarkingForm
                    key={attempt.attemptId}
                    testId={testId}
                    marking={marking}
                    attempt={attempt}
                    onSaved={() => openNext(attempt.attemptId)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Page>
  );
}
