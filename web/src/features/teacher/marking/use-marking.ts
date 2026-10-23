import type {
  AttemptMarkingResponse,
  MarkingResponse,
  ReleaseOptions,
  ReleaseResultsRequest,
  ReleaseResultsResponse,
  SaveMarksRequest,
} from '@exam-room/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteResource, getJson, putJson } from '../../../api/http-client';
import { testQueryKeys } from '../tests/use-tests';

const markingQueryKey = (testId: number) => [...testQueryKeys.detail(testId), 'marking'] as const;

export function useMarking(testId: number) {
  return useQuery({
    queryKey: markingQueryKey(testId),
    queryFn: () => getJson<MarkingResponse>(`/tests/${testId}/marking`),
  });
}

export function useSaveMarks(testId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attemptId, marks }: { attemptId: number; marks: SaveMarksRequest }) =>
      putJson<AttemptMarkingResponse>(`/attempts/${attemptId}/marks`, marks),
    onSuccess: ({ attempt }) => {
      queryClient.setQueryData<MarkingResponse>(markingQueryKey(testId), (marking) =>
        marking
          ? {
              ...marking,
              attempts: marking.attempts.map((current) =>
                current.attemptId === attempt.attemptId ? attempt : current,
              ),
            }
          : marking,
      );
      return queryClient.invalidateQueries({ queryKey: testQueryKeys.detail(testId) });
    },
  });
}

export function useRelease(testId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (options: ReleaseOptions | null): Promise<void> => {
      if (options) {
        await putJson<ReleaseResultsResponse>(
          `/tests/${testId}/release`,
          options satisfies ReleaseResultsRequest,
        );
      } else {
        await deleteResource(`/tests/${testId}/release`);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: testQueryKeys.everything }),
  });
}
