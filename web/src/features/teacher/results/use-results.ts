import type {
  AttemptResultListResponse,
  AttemptResultResponse,
  AttemptResult,
} from '@exam-room/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson, postJson } from '../../../api/http-client';

const RESULTS_REFRESH_INTERVAL_MS = 5000;

export const resultsQueryKey = (testId: number) => ['test-results', testId] as const;

export function useTestResults(testId: number) {
  return useQuery({
    queryKey: resultsQueryKey(testId),
    queryFn: () => getJson<AttemptResultListResponse>(`/tests/${testId}/attempts`),
    refetchInterval: RESULTS_REFRESH_INTERVAL_MS,
  });
}

export function useUnlockAttempt(testId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attemptId: number) =>
      postJson<AttemptResultResponse>(`/attempts/${attemptId}/unlock`),
    onSuccess: ({ attempt }) => {
      queryClient.setQueryData<AttemptResultListResponse>(
        resultsQueryKey(testId),
        (results) => results && { ...results, attempts: replaceAttempt(results.attempts, attempt) },
      );
    },
  });
}

function replaceAttempt(attempts: AttemptResult[], changed: AttemptResult): AttemptResult[] {
  return attempts.map((attempt) => (attempt.id === changed.id ? changed : attempt));
}
