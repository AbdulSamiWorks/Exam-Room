import type { PublicTest } from '@exam-room/shared';
import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Page } from '../../../components/Page';
import { Panel } from '../../../components/Panel';
import { TextField } from '../../../components/TextField';
import { describeDuration, describePageCount } from '../../../lib/describe-test-length';
import { enterFullscreen } from '../fullscreen';
import { ErrorScreen } from '../screens/ErrorScreen';
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

  return <JoinForm test={testQuery.data} testCode={testCode} onStarted={onStarted} />;
}

function JoinForm({ test, testCode, onStarted }: JoinScreenProps & { test: PublicTest }) {
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
            <li>{describeExitRule(test.allowedExits)}</li>
            <li>Your name and roll number are printed on every page.</li>
            <li>Answer on your own paper. When you are done, tap Finish.</li>
          </ul>
        </Panel>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
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
            {startAttempt.isPending ? 'Starting…' : 'Start test'}
          </Button>
        </form>
      </div>
    </Page>
  );
}

function describeExitRule(allowedExits: PublicTest['allowedExits']): string {
  if (allowedExits === 0) {
    return 'Do not leave this page or switch apps. If you do, your test is locked at once.';
  }
  const times = allowedExits === 1 ? 'once' : 'twice';
  return `Do not leave this page or switch apps. You may leave ${times} by accident; after that your test is locked.`;
}
