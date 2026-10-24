import type { StudentResultResponse } from '@exam-room/shared';
import { useQuery } from '@tanstack/react-query';
import { getJson } from '../../api/http-client';

export function useStudentResult(testCode: string, isEnabled = true) {
  return useQuery({
    queryKey: ['student-result', testCode],
    queryFn: () => getJson<StudentResultResponse>(`/student/results/${testCode}`),
    retry: false,
    enabled: isEnabled,
  });
}
