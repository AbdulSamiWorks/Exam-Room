import type { AttemptResponse } from '@exam-room/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { ApiError } from '../../../api/http-client';
import { readStoredAttempt, updateStoredAttempt, type PendingExit } from '../attempt-storage';
import { reportExit, reportReturn } from '../student-api';
import { setAttemptData, studentQueryKeys } from '../use-attempt';
import { startExitTracker } from './exit-tracker';

const RETURN_RETRY_DELAY_MS = 3000;

type ExitReportingOptions = {
  testCode: string;
  attemptToken: string;
  isWatching: boolean;
};

export function useExitReporting({ testCode, attemptToken, isWatching }: ExitReportingOptions) {
  const queryClient = useQueryClient();
  const isWatchingRef = useRef(isWatching);

  useEffect(() => {
    isWatchingRef.current = isWatching;
  }, [isWatching]);

  useEffect(() => {
    let isStopped = false;
    let retryTimer: number | undefined;
    let leaveRequest: Promise<unknown> = Promise.resolve();

    function applyResponse(response: AttemptResponse): void {
      if (!isStopped) setAttemptData(queryClient, testCode, response);
    }

    function handleRequestError(error: unknown): boolean {
      const canRetry = !(error instanceof ApiError) || !error.isClientError;
      if (!canRetry) {
        void queryClient.invalidateQueries({ queryKey: studentQueryKeys.attempt(testCode) });
      }
      return canRetry;
    }

    function sendLeave(exit: PendingExit): void {
      updateStoredAttempt(testCode, { pendingExit: exit });
      leaveRequest = reportExit(attemptToken, {
        clientExitId: exit.clientExitId,
        reason: exit.reason,
      })
        .then(applyResponse)
        .catch(() => undefined);
    }

    function sendReturn(exit: PendingExit, awayMs: number): void {
      void leaveRequest
        .then(() =>
          reportReturn(attemptToken, {
            clientExitId: exit.clientExitId,
            reason: exit.reason,
            awayMsClient: awayMs,
          }),
        )
        .then((response) => {
          updateStoredAttempt(testCode, { pendingExit: undefined });
          applyResponse(response);
        })
        .catch((error: unknown) => {
          if (isStopped || !handleRequestError(error)) return;
          retryTimer = window.setTimeout(() => sendReturn(exit, awayMs), RETURN_RETRY_DELAY_MS);
        });
    }

    const stopTracker = startExitTracker({
      unfinishedExit: readStoredAttempt(testCode)?.pendingExit,
      isWatching: () => isWatchingRef.current,
      onLeave: sendLeave,
      onReturn: sendReturn,
    });

    return () => {
      isStopped = true;
      window.clearTimeout(retryTimer);
      stopTracker();
    };
  }, [attemptToken, testCode, queryClient]);
}
