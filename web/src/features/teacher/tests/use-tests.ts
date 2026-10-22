import type { TestListResponse, TestResponse } from '@exam-room/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson, postForm } from '../../../api/http-client';

const ALL_SUBJECTS = 'all';

export const testQueryKeys = {
  everything: ['tests'] as const,
  lists: () => [...testQueryKeys.everything, 'list'] as const,
  list: (subjectId?: number) => [...testQueryKeys.lists(), subjectId ?? ALL_SUBJECTS] as const,
  detail: (testId: number) => [...testQueryKeys.everything, 'detail', testId] as const,
};

export function useTestList(subjectId?: number) {
  return useQuery({
    queryKey: testQueryKeys.list(subjectId),
    queryFn: () => {
      const query = subjectId === undefined ? '' : `?subjectId=${subjectId}`;
      return getJson<TestListResponse>(`/tests${query}`);
    },
    select: (response) => response.tests,
  });
}

export function useTest(testId: number) {
  return useQuery({
    queryKey: testQueryKeys.detail(testId),
    queryFn: () => getJson<TestResponse>(`/tests/${testId}`),
    select: (response) => response.test,
  });
}

export function useCreateTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => postForm<TestResponse>('/tests', formData),
    onSuccess: (response) => {
      queryClient.setQueryData(testQueryKeys.detail(response.test.id), response);
      return queryClient.invalidateQueries({ queryKey: testQueryKeys.lists() });
    },
  });
}
