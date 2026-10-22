import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/http-client';

const MAX_QUERY_RETRIES = 2;

export function createQueryClient(): QueryClient {
  return new QueryClient({
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
}

function shouldRetryQuery(failureCount: number, error: Error): boolean {
  const isClientError = error instanceof ApiError && error.isClientError;
  return !isClientError && failureCount < MAX_QUERY_RETRIES;
}
