import { useQuery } from '@tanstack/react-query';
import { fetchStudentPaper } from '../student-api';
import { studentQueryKeys } from '../use-attempt';

export function useStudentPaper(testCode: string, attemptToken: string) {
  return useQuery({
    queryKey: studentQueryKeys.paper(testCode),
    queryFn: () => fetchStudentPaper(attemptToken),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
