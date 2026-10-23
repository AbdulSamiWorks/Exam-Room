import type { StudentAttempt } from '@exam-room/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchSavedAnswers } from '../student-api';
import { setAttemptData } from '../use-attempt';
import {
  loadOutbox,
  mergeServerAnswers,
  onFinished,
  setServerClock,
  useOutbox,
} from './outbox-store';

export function useAnswerOutbox(
  testCode: string,
  attemptToken: string,
  attempt: StudentAttempt | undefined,
  attemptReceivedAt: number,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    void loadOutbox(testCode, attemptToken);
  }, [testCode, attemptToken]);

  useEffect(() => {
    if (attempt) setServerClock(testCode, attempt.serverTime, attemptReceivedAt);
  }, [testCode, attempt, attemptReceivedAt]);

  useEffect(
    () =>
      onFinished((finishedTestCode, response) => {
        if (finishedTestCode === testCode) setAttemptData(queryClient, testCode, response);
      }),
    [queryClient, testCode],
  );

  return useOutbox(testCode);
}

export function useSavedAnswersRestore(testCode: string, attemptToken: string, isEnabled: boolean) {
  const savedAnswers = useQuery({
    queryKey: ['student-saved-answers', testCode, attemptToken],
    queryFn: () => fetchSavedAnswers(attemptToken),
    enabled: isEnabled,
    staleTime: Infinity,
    retry: 2,
  });

  useEffect(() => {
    if (savedAnswers.data) {
      mergeServerAnswers(testCode, savedAnswers.data.answers, savedAnswers.dataUpdatedAt);
    }
  }, [testCode, savedAnswers.data, savedAnswers.dataUpdatedAt]);
}
