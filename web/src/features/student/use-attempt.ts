import type { AttemptResponse, AttemptStatus } from '@exam-room/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api/http-client';
import { saveStoredAttempt } from './attempt-storage';
import { fetchAttempt, fetchPublicTest, startAttempt } from './student-api';

const LOCKED_REFRESH_INTERVAL_MS = 5000;
const IN_PROGRESS_REFRESH_INTERVAL_MS = 30_000;
const WAITING_FOR_OPENING_REFRESH_INTERVAL_MS = 5000;
const WAITING_ROOM_REFRESH_INTERVAL_MS = 3000;
const UNAUTHORIZED_STATUS = 401;
const TEST_NOT_STARTABLE_ERROR_CODES = new Set(['test_not_open', 'test_closed']);

export const studentQueryKeys = {
  publicTest: (testCode: string) => ['public-test', testCode] as const,
  attempt: (testCode: string) => ['student-attempt', testCode] as const,
  pageImages: (testCode: string) => ['student-page-image', testCode] as const,
  paper: (testCode: string) => ['student-paper', testCode] as const,
};

export function isSessionLostError(error: unknown): boolean {
  return error instanceof ApiError && error.status === UNAUTHORIZED_STATUS;
}

export function usePublicTest(testCode: string) {
  return useQuery({
    queryKey: studentQueryKeys.publicTest(testCode),
    queryFn: () => fetchPublicTest(testCode),
    select: (response) => response.test,
    refetchInterval: (query) =>
      query.state.data?.test.availability === 'open'
        ? false
        : WAITING_FOR_OPENING_REFRESH_INTERVAL_MS,
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
  if (status === 'waiting') return WAITING_ROOM_REFRESH_INTERVAL_MS;
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
    mutationFn: () => startAttempt(testCode),
    onSuccess: ({ attemptToken, attempt }) => {
      saveStoredAttempt(testCode, { attemptToken, acknowledgedExits: 0 });
      setAttemptData(queryClient, testCode, { attempt });
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) return;
      if (TEST_NOT_STARTABLE_ERROR_CODES.has(error.code)) {
        return queryClient.invalidateQueries({ queryKey: studentQueryKeys.publicTest(testCode) });
      }
    },
  });
}
