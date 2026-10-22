import type { TestResponse } from '@exam-room/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson, postForm } from '../../../api/http-client';

export const testsQueryKey = ['tests'] as const;

export function testQueryKey(testId: number) {
  return [...testsQueryKey, testId] as const;
}

export function useTest(testId: number) {
  return useQuery({
    queryKey: testQueryKey(testId),
    queryFn: () => getJson<TestResponse>(`/tests/${testId}`),
    select: (response) => response.test,
  });
}

export function useCreateTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => postForm<TestResponse>('/tests', formData),
    onSuccess: (response) => {
      queryClient.setQueryData(testQueryKey(response.test.id), response);
      return queryClient.invalidateQueries({ queryKey: testsQueryKey, exact: true });
    },
  });
}
