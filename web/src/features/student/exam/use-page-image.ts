import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ApiError } from '../../../api/http-client';
import { fetchPageImage, fetchPaperPicture } from '../student-api';
import { studentQueryKeys } from '../use-attempt';

const PAPER_CLOSED_STATUS = 410;

export type ExamImage = {
  kind: 'page' | 'picture';
  number: number;
};

function examImageQuery(
  queryClient: QueryClient,
  testCode: string,
  attemptToken: string,
  { kind, number }: ExamImage,
) {
  const fetchImage = kind === 'page' ? fetchPageImage : fetchPaperPicture;
  return queryOptions({
    queryKey: [...studentQueryKeys.pageImages(testCode), kind, number],
    queryFn: async () => {
      try {
        return URL.createObjectURL(await fetchImage(attemptToken, number));
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

export function useExamImage(testCode: string, attemptToken: string, image: ExamImage) {
  const queryClient = useQueryClient();
  return useQuery(examImageQuery(queryClient, testCode, attemptToken, image));
}

export function usePrefetchExamImages(
  testCode: string,
  attemptToken: string,
  kind: ExamImage['kind'],
  imageCount: number,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let isStopped = false;

    async function prefetchImagesInOrder(): Promise<void> {
      for (let number = 1; number <= imageCount && !isStopped; number++) {
        try {
          await queryClient.fetchQuery(
            examImageQuery(queryClient, testCode, attemptToken, { kind, number }),
          );
        } catch (error) {
          if (isPaperClosedError(error)) return;
        }
      }
    }

    void prefetchImagesInOrder();
    return () => {
      isStopped = true;
    };
  }, [queryClient, testCode, attemptToken, kind, imageCount]);
}

export function forgetPaper(queryClient: QueryClient, testCode: string): void {
  const queryKey = studentQueryKeys.pageImages(testCode);
  for (const [, objectUrl] of queryClient.getQueriesData<string>({ queryKey })) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
  queryClient.removeQueries({ queryKey });
  queryClient.removeQueries({ queryKey: studentQueryKeys.paper(testCode) });
}
