import type { SessionResponse } from '@exam-room/shared';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/http-client';
import {
  SESSION_EXPIRED_ERROR_CODE,
  teacherSessionQueryKey,
} from '../features/teacher/auth/use-teacher-session';

const MAX_QUERY_RETRIES = 2;

export function createQueryClient(): QueryClient {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => showLoginIfSessionExpired(queryClient, error),
    }),
    mutationCache: new MutationCache({
      onError: (error) => showLoginIfSessionExpired(queryClient, error),
    }),
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
  return queryClient;
}

function showLoginIfSessionExpired(queryClient: QueryClient, error: Error): void {
  if (error instanceof ApiError && error.code === SESSION_EXPIRED_ERROR_CODE) {
    queryClient.setQueryData<SessionResponse>(teacherSessionQueryKey, { authenticated: false });
  }
}

function shouldRetryQuery(failureCount: number, error: Error): boolean {
  const isClientError = error instanceof ApiError && error.isClientError;
  return !isClientError && failureCount < MAX_QUERY_RETRIES;
}
