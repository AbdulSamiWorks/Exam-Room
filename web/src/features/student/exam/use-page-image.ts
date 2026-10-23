import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ApiError } from '../../../api/http-client';
import { fetchPageImage } from '../student-api';
import { studentQueryKeys } from '../use-attempt';

const PAPER_CLOSED_STATUS = 410;

function pageImageQuery(
  queryClient: QueryClient,
  testCode: string,
  attemptToken: string,
  pageNumber: number,
) {
  return queryOptions({
    queryKey: studentQueryKeys.pageImage(testCode, pageNumber),
    queryFn: async () => {
      try {
        return URL.createObjectURL(await fetchPageImage(attemptToken, pageNumber));
      } catch (error) {
        if (error instanceof ApiError && error.status === PAPER_CLOSED_STATUS) {
          void queryClient.invalidateQueries({ queryKey: studentQueryKeys.attempt(testCode) });
        }
        throw error;
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function usePageImage(testCode: string, attemptToken: string, pageNumber: number) {
  const queryClient = useQueryClient();
  return useQuery(pageImageQuery(queryClient, testCode, attemptToken, pageNumber));
}

export function usePrefetchPageImage(
  testCode: string,
  attemptToken: string,
  pageNumber: number | undefined,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (pageNumber === undefined) return;
    void queryClient.prefetchQuery(pageImageQuery(queryClient, testCode, attemptToken, pageNumber));
  }, [queryClient, testCode, attemptToken, pageNumber]);
}

export function forgetPageImages(queryClient: QueryClient, testCode: string): void {
  const queryKey = studentQueryKeys.pageImages(testCode);
  for (const [, objectUrl] of queryClient.getQueriesData<string>({ queryKey })) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
  queryClient.removeQueries({ queryKey });
}
