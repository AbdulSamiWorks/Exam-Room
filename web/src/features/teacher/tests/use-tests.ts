import type {
  ScheduleTestRequest,
  TestListResponse,
  TestResponse,
  TestSummary,
} from '@exam-room/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson, postForm, postJson, putJson } from '../../../api/http-client';

const ALL_SUBJECTS = 'all';
const SCHEDULE_REFRESH_INTERVAL_MS = 10_000;

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
    refetchInterval: (query) =>
      hasUpcomingScheduleChange(query.state.data?.test) ? SCHEDULE_REFRESH_INTERVAL_MS : false,
  });
}

function hasUpcomingScheduleChange(test: TestSummary | undefined): boolean {
  if (test?.availability === 'scheduled') return true;
  return test?.availability === 'open' && test.closesAt !== null;
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

export function useOpenTest(testId: number) {
  return useTestChange(testId, () => postJson<TestResponse>(`/tests/${testId}/open`));
}

export function useCloseTest(testId: number) {
  return useTestChange(testId, () => postJson<TestResponse>(`/tests/${testId}/close`));
}

export function useScheduleTest(testId: number) {
  return useTestChange(testId, (schedule: ScheduleTestRequest) =>
    putJson<TestResponse>(`/tests/${testId}/schedule`, schedule),
  );
}

function useTestChange<Variables>(
  testId: number,
  sendChange: (variables: Variables) => Promise<TestResponse>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendChange,
    onSuccess: (response) => {
      queryClient.setQueryData(testQueryKeys.detail(testId), response);
      return queryClient.invalidateQueries({ queryKey: testQueryKeys.lists() });
    },
  });
}
