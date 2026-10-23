import type { PublicTest } from '@exam-room/shared';
import { useState } from 'react';
import { Button, ButtonLink } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Page } from '../../../components/Page';
import { Panel } from '../../../components/Panel';
import { ThemeToggle } from '../../../components/ThemeToggle';
import { describeDateTime } from '../../../lib/describe-date-time';
import { describeDuration, describePageCount } from '../../../lib/describe-test-length';
import { enterFullscreen } from '../fullscreen';
import { ErrorScreen } from '../screens/ErrorScreen';
import { TestNotOpenScreen } from '../screens/TestNotOpenScreen';
import { usePublicTest, useStartAttempt } from '../use-attempt';
import { studentLoginPath, studentTestPath } from '../../student-account/student-paths';
import { useStudentSession } from '../../student-account/use-student-account';
import styles from './JoinScreen.module.css';

type JoinScreenProps = {
  testCode: string;
  onStarted: (attemptToken: string) => void;
};

export function JoinScreen({ testCode, onStarted }: JoinScreenProps) {
  const testQuery = usePublicTest(testCode);
  const [hasAlreadyStarted, setHasAlreadyStarted] = useState(false);

  if (testQuery.isPending) return <LoadingScreen />;
  if (testQuery.isError) {
    return (
      <ErrorScreen
        title="Test not available"
        message={testQuery.error.message}
        onRetry={() => void testQuery.refetch()}
      />
    );
  }

  const test = testQuery.data;
  const isResuming = test.availability === 'closed' && hasAlreadyStarted;
  if (test.availability !== 'open' && !isResuming) {
    return <TestNotOpenScreen test={test} onAlreadyStarted={() => setHasAlreadyStarted(true)} />;
  }

  return <JoinForm test={test} testCode={testCode} onStarted={onStarted} isResuming={isResuming} />;
}

type JoinFormProps = JoinScreenProps & {
  test: PublicTest;
  isResuming: boolean;
};

function JoinForm({ test, testCode, onStarted, isResuming }: JoinFormProps) {
  const session = useStudentSession();
  const startAttempt = useStartAttempt(testCode);

  function start() {
    enterFullscreen();
    startAttempt.mutate(undefined, { onSuccess: ({ attemptToken }) => onStarted(attemptToken) });
  }

  if (session.isPending) return <LoadingScreen />;
  const student = session.data;

  return (
    <Page title={test.title} subtitle={test.subjectName} actions={<ThemeToggle />}>
      <div className={styles.sections}>
        <Panel title="Before you start">
          <ul className={styles.rules}>
            <li>
              Time limit: <strong>{describeDuration(test.durationMinutes)}</strong> (
              {describePageCount(test.pageCount)}). The timer starts when you tap Start test and
              never stops.
            </li>
            {test.closesAt !== null && !isResuming && (
              <li>
                You can start until <strong>{describeDateTime(test.closesAt)}</strong>.
              </li>
            )}
            <li>{describeExitRule(test)}</li>
            <li>Answer on your own paper. When you are done, tap Finish.</li>
          </ul>
        </Panel>

        {student ? (
          <div className={styles.form}>
            <p className={styles.note}>
              {student.name} · {student.schoolClass.name} · Roll number {student.rollNumber}
            </p>
            {startAttempt.error && <FormError>{startAttempt.error.message}</FormError>}
            <Button size="large" fullWidth disabled={startAttempt.isPending} onClick={start}>
              {describeStartButton(startAttempt.isPending, isResuming)}
            </Button>
          </div>
        ) : (
          <div className={styles.form}>
            <p className={styles.note}>Log in with your roll number and PIN to start this test.</p>
            <ButtonLink to={studentLoginPath(studentTestPath(testCode))} size="large" fullWidth>
              Log in to start
            </ButtonLink>
          </div>
        )}
      </div>
    </Page>
  );
}

function describeStartButton(isPending: boolean, isResuming: boolean): string {
  if (isResuming) return isPending ? 'Opening…' : 'Continue test';
  return isPending ? 'Starting…' : 'Start test';
}

function describeExitRule({ allowedExits, leaveRule }: PublicTest): string {
  const consequence =
    leaveRule === 'finish'
      ? 'your test is finished and you cannot come back'
      : 'your test is locked';
  if (allowedExits === 0) {
    return `Do not leave this page or switch apps. If you do, ${consequence} at once.`;
  }
  const times = allowedExits === 1 ? 'once' : 'twice';
  return `Do not leave this page or switch apps. You may leave ${times} by accident; after that ${consequence}.`;
}
