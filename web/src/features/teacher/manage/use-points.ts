import type {
  AddPointsRequest,
  ClassPointsResponse,
  StudentPointsHistoryResponse,
} from '@exam-room/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson, postJson } from '../../../api/http-client';
import { classQueryKeys } from './use-classes';

const pointsQueryKey = (classId: number) => [...classQueryKeys.tree, classId, 'points'] as const;

export function useClassPoints(classId: number) {
  return useQuery({
    queryKey: pointsQueryKey(classId),
    queryFn: () => getJson<ClassPointsResponse>(`/classes/${classId}/points`),
    select: (response) => response.students,
  });
}

export function useAddPoints(classId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, change }: { studentId: number; change: AddPointsRequest }) =>
      postJson<StudentPointsHistoryResponse>(`/students/${studentId}/points`, change),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pointsQueryKey(classId) }),
  });
}
