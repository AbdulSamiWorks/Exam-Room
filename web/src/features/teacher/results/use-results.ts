import type {
  AttemptResultListResponse,
  AttemptResultResponse,
  AttemptResult,
} from '@exam-room/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { deleteResource, getJson, postJson } from '../../../api/http-client';
import { testQueryKeys } from '../tests/use-tests';

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
      updateResults(queryClient, testId, (attempts) => replaceAttempt(attempts, attempt));
    },
  });
}

export function useDeleteAttempt(testId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attemptId: number) => deleteResource(`/attempts/${attemptId}`),
    onSuccess: (_response, attemptId) => {
      updateResults(queryClient, testId, (attempts) =>
        attempts.filter((attempt) => attempt.id !== attemptId),
      );
      return queryClient.invalidateQueries({ queryKey: testQueryKeys.everything });
    },
  });
}

function updateResults(
  queryClient: QueryClient,
  testId: number,
  changeAttempts: (attempts: AttemptResult[]) => AttemptResult[],
): void {
  queryClient.setQueryData<AttemptResultListResponse>(
    resultsQueryKey(testId),
    (results) => results && { ...results, attempts: changeAttempts(results.attempts) },
  );
}

function replaceAttempt(attempts: AttemptResult[], changed: AttemptResult): AttemptResult[] {
  return attempts.map((attempt) => (attempt.id === changed.id ? changed : attempt));
}
