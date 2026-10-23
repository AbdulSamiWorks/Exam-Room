import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { LoadingScreen } from '../../components/LoadingScreen';
import { readStoredAttempt, updateStoredAttempt } from './attempt-storage';
import { ExamScreen } from './exam/ExamScreen';
import { forgetPaper } from './exam/use-page-image';
import { useExitReporting } from './exit-detection/use-exit-reporting';
import { enterFullscreen } from './fullscreen';
import { ErrorScreen } from './screens/ErrorScreen';
import { FinishedScreen } from './screens/FinishedScreen';
import { LockedScreen } from './screens/LockedScreen';
import { SessionLostScreen } from './screens/SessionLostScreen';
import { WarningScreen } from './screens/WarningScreen';
import { isSessionLostError, useAttempt } from './use-attempt';
import { useScreenWakeLock } from './use-screen-wake-lock';

type AttemptScreenProps = {
  testCode: string;
  attemptToken: string;
  onSessionLost: () => void;
};

export function AttemptScreen({ testCode, attemptToken, onSessionLost }: AttemptScreenProps) {
  const queryClient = useQueryClient();
  const attemptQuery = useAttempt(testCode, attemptToken);
  const status = attemptQuery.data?.status;
  const [acknowledgedExits, acknowledgeExits] = useAcknowledgedExits(testCode);
  const { refetch } = attemptQuery;
  const reloadAttempt = useCallback(() => void refetch(), [refetch]);

  useExitReporting({ testCode, attemptToken, isWatching: status === 'in_progress' });
  useScreenWakeLock(status === 'in_progress');

  useEffect(() => {
    if (status && status !== 'in_progress') forgetPaper(queryClient, testCode);
  }, [status, queryClient, testCode]);

  if (attemptQuery.isPending) return <LoadingScreen message="Opening your test…" />;

  if (attemptQuery.isError) {
    if (isSessionLostError(attemptQuery.error)) {
      return <SessionLostScreen onOpenAgain={onSessionLost} />;
    }
    return <ErrorScreen message={attemptQuery.error.message} onRetry={reloadAttempt} />;
  }

  const attempt = attemptQuery.data;
  if (attempt.status === 'submitted') return <FinishedScreen attempt={attempt} />;
  if (attempt.status === 'locked') return <LockedScreen />;

  const hasUnseenExit = attempt.exitsUsed > acknowledgedExits;

  return (
    <>
      <ExamScreen
        testCode={testCode}
        attemptToken={attemptToken}
        attempt={attempt}
        onTimeUp={reloadAttempt}
      />
      {hasUnseenExit && (
        <WarningScreen
          attempt={attempt}
          onContinue={() => {
            enterFullscreen();
            acknowledgeExits(attempt.exitsUsed);
          }}
        />
      )}
    </>
  );
}

function useAcknowledgedExits(testCode: string) {
  const [acknowledgedExits, setAcknowledgedExits] = useState(
    () => readStoredAttempt(testCode)?.acknowledgedExits ?? 0,
  );

  const acknowledgeExits = useCallback(
    (exitsUsed: number) => {
      updateStoredAttempt(testCode, { acknowledgedExits: exitsUsed });
      setAcknowledgedExits(exitsUsed);
    },
    [testCode],
  );

  return [acknowledgedExits, acknowledgeExits] as const;
}
