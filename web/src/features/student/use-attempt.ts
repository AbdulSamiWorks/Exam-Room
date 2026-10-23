import type { AttemptResponse, AttemptStatus, StartAttemptRequest } from '@exam-room/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api/http-client';
import { saveStoredAttempt } from './attempt-storage';
import { fetchAttempt, fetchPublicTest, finishAttempt, startAttempt } from './student-api';

const LOCKED_REFRESH_INTERVAL_MS = 5000;
const IN_PROGRESS_REFRESH_INTERVAL_MS = 30_000;
const UNAUTHORIZED_STATUS = 401;

export const studentQueryKeys = {
  publicTest: (testCode: string) => ['public-test', testCode] as const,
  attempt: (testCode: string) => ['student-attempt', testCode] as const,
  pageImages: (testCode: string) => ['student-page-image', testCode] as const,
  pageImage: (testCode: string, pageNumber: number) =>
    [...studentQueryKeys.pageImages(testCode), pageNumber] as const,
};

export function isSessionLostError(error: unknown): boolean {
  return error instanceof ApiError && error.status === UNAUTHORIZED_STATUS;
}

export function usePublicTest(testCode: string) {
  return useQuery({
    queryKey: studentQueryKeys.publicTest(testCode),
    queryFn: () => fetchPublicTest(testCode),
    select: (response) => response.test,
  });
}

export function useAttempt(testCode: string, attemptToken: string) {
  return useQuery({
    queryKey: studentQueryKeys.attempt(testCode),
    queryFn: () => fetchAttempt(attemptToken),
    select: (response) => response.attempt,
    refetchInterval: (query) => refreshIntervalFor(query.state.data?.attempt.status),
  });
}

function refreshIntervalFor(status: AttemptStatus | undefined): number | false {
  if (status === 'locked') return LOCKED_REFRESH_INTERVAL_MS;
  if (status === 'in_progress') return IN_PROGRESS_REFRESH_INTERVAL_MS;
  return false;
}

export function setAttemptData(
  queryClient: QueryClient,
  testCode: string,
  response: AttemptResponse,
): void {
  queryClient.setQueryData(studentQueryKeys.attempt(testCode), response);
}

export function useStartAttempt(testCode: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (student: StartAttemptRequest) => startAttempt(testCode, student),
    onSuccess: ({ attemptToken, attempt }) => {
      saveStoredAttempt(testCode, { attemptToken, acknowledgedExits: 0 });
      setAttemptData(queryClient, testCode, { attempt });
    },
  });
}

export function useFinishAttempt(testCode: string, attemptToken: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => finishAttempt(attemptToken),
    onSuccess: (response) => setAttemptData(queryClient, testCode, response),
  });
}
