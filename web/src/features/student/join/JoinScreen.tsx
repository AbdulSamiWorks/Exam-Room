import type { PublicTest } from '@exam-room/shared';
import { useState } from 'react';
import { Button, ButtonLink } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Page } from '../../../components/Page';
import { Panel } from '../../../components/Panel';
import { ThemeToggle } from '../../../components/ThemeToggle';
import { describeDateTime } from '../../../lib/describe-date-time';
import { describeDuration, describePaperSize } from '../../../lib/describe-test-length';
import { enterFullscreen } from '../fullscreen';
import { ErrorScreen } from '../screens/ErrorScreen';
import { TestNotOpenScreen } from '../screens/TestNotOpenScreen';
import { usePublicTest, useStartAttempt } from '../use-attempt';
import { studentLoginPath, studentTestPath } from '../../student-account/student-paths';
import { useStudentSession } from '../../student-account/use-student-account';
import { describeBounty } from '../../../lib/describe-bounty';
import { describeHowToAnswer } from '../answers/answer-rules';
import { PhoneLockSteps } from './PhoneLockSteps';
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
            {test.kind === 'assignment' ? (
              <li>
                No time limit ({describePaperSize(test)}). You can leave and come back.
                {test.closesAt !== null && (
                  <>
                    {' '}
                    Hand it in before <strong>{describeDateTime(test.closesAt)}</strong>.
                  </>
                )}
              </li>
            ) : (
              <li>
                Time limit: <strong>{describeDuration(test.durationMinutes)}</strong> (
                {describePaperSize(test)}).{' '}
                {test.waitingRoom
                  ? 'After you tap Start test you wait until your teacher starts everyone together. Then the timer starts and never stops.'
                  : 'The timer starts when you tap Start test and never stops.'}
              </li>
            )}
            {test.closesAt !== null && !isResuming && test.kind !== 'assignment' && (
              <li>
                You can start until <strong>{describeDateTime(test.closesAt)}</strong>.
              </li>
            )}
            {test.kind !== 'assignment' && <li>{describeExitRule(test)}</li>}
            {describeBounty(test.bountyNote, test.bountyPoints) && (
              <li>{describeBounty(test.bountyNote, test.bountyPoints)}</li>
            )}
            <li>{describeHowToAnswer(test)}</li>
            {test.instantMcqResult && test.questionCount > 0 && (
              <li>You see your multiple choice result as soon as you finish.</li>
            )}
          </ul>
        </Panel>

        {test.kind !== 'assignment' && <PhoneLockSteps />}

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
