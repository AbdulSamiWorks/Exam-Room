import type { PublicTest } from '@exam-room/shared';
import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Page } from '../../../components/Page';
import { Panel } from '../../../components/Panel';
import { TextField } from '../../../components/TextField';
import { describeDateTime } from '../../../lib/describe-date-time';
import { describeDuration, describePageCount } from '../../../lib/describe-test-length';
import { enterFullscreen } from '../fullscreen';
import { ErrorScreen } from '../screens/ErrorScreen';
import { TestNotOpenScreen } from '../screens/TestNotOpenScreen';
import { usePublicTest, useStartAttempt } from '../use-attempt';
import { studentLimits } from './student-limits';
import styles from './JoinScreen.module.css';

type JoinErrors = Partial<Record<'studentName' | 'rollNumber', string>>;

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
  const startAttempt = useStartAttempt(testCode);
  const [studentName, setStudentName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [errors, setErrors] = useState<JoinErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors: JoinErrors = {
      studentName: studentName.trim() ? undefined : 'Enter your name.',
      rollNumber: rollNumber.trim() ? undefined : 'Enter your roll number.',
    };
    setErrors(validationErrors);
    if (validationErrors.studentName || validationErrors.rollNumber) return;

    enterFullscreen();
    startAttempt.mutate(
      { studentName: studentName.trim(), rollNumber: rollNumber.trim() },
      { onSuccess: ({ attemptToken }) => onStarted(attemptToken) },
    );
  }

  return (
    <Page title={test.title} subtitle={test.subjectName}>
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
            <li>{describeExitRule(test.allowedExits)}</li>
            <li>Your name and roll number are printed on every page.</li>
            <li>Answer on your own paper. When you are done, tap Finish.</li>
          </ul>
        </Panel>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {isResuming && (
            <p className={styles.note}>
              Enter the same name and roll number you used when you started.
            </p>
          )}
          <TextField
            label="Your name"
            autoComplete="name"
            value={studentName}
            maxLength={studentLimits.maxNameLength}
            onChange={(event) => setStudentName(event.target.value)}
            errorMessage={errors.studentName}
          />
          <TextField
            label="Roll number"
            autoComplete="off"
            value={rollNumber}
            maxLength={studentLimits.maxRollNumberLength}
            onChange={(event) => setRollNumber(event.target.value)}
            errorMessage={errors.rollNumber}
          />

          {startAttempt.error && <FormError>{startAttempt.error.message}</FormError>}

          <Button type="submit" size="large" fullWidth disabled={startAttempt.isPending}>
            {describeStartButton(startAttempt.isPending, isResuming)}
          </Button>
        </form>
      </div>
    </Page>
  );
}

function describeStartButton(isPending: boolean, isResuming: boolean): string {
  if (isResuming) return isPending ? 'Opening…' : 'Continue test';
  return isPending ? 'Starting…' : 'Start test';
}

function describeExitRule(allowedExits: PublicTest['allowedExits']): string {
  if (allowedExits === 0) {
    return 'Do not leave this page or switch apps. If you do, your test is locked at once.';
  }
  const times = allowedExits === 1 ? 'once' : 'twice';
  return `Do not leave this page or switch apps. You may leave ${times} by accident; after that your test is locked.`;
}
