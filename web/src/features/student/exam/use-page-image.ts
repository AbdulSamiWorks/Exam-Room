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
        if (isPaperClosedError(error)) {
          void queryClient.invalidateQueries({ queryKey: studentQueryKeys.attempt(testCode) });
        }
        throw error;
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

function isPaperClosedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === PAPER_CLOSED_STATUS;
}

export function usePageImage(testCode: string, attemptToken: string, pageNumber: number) {
  const queryClient = useQueryClient();
  return useQuery(pageImageQuery(queryClient, testCode, attemptToken, pageNumber));
}

export function usePrefetchAllPageImages(
  testCode: string,
  attemptToken: string,
  pageCount: number,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let isStopped = false;

    async function prefetchPagesInOrder(): Promise<void> {
      for (let pageNumber = 1; pageNumber <= pageCount && !isStopped; pageNumber++) {
        try {
          await queryClient.fetchQuery(
            pageImageQuery(queryClient, testCode, attemptToken, pageNumber),
          );
        } catch (error) {
          if (isPaperClosedError(error)) return;
        }
      }
    }

    void prefetchPagesInOrder();
    return () => {
      isStopped = true;
    };
  }, [queryClient, testCode, attemptToken, pageCount]);
}

export function forgetPageImages(queryClient: QueryClient, testCode: string): void {
  const queryKey = studentQueryKeys.pageImages(testCode);
  for (const [, objectUrl] of queryClient.getQueriesData<string>({ queryKey })) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
  queryClient.removeQueries({ queryKey });
}
