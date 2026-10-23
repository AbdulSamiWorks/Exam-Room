import type { ProgressResponse } from '@exam-room/shared';
import { useQuery } from '@tanstack/react-query';
import { getJson } from '../../api/http-client';

export function useStudentProgress() {
  return useQuery({
    queryKey: ['student-progress'],
    queryFn: () => getJson<ProgressResponse>('/student/progress'),
  });
}
