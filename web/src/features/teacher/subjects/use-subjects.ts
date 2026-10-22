import type {
  CreateSubjectRequest,
  CreateSubjectResponse,
  Subject,
  SubjectListResponse,
} from '@exam-room/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson, postJson } from '../../../api/http-client';

const subjectsQueryKey = ['subjects'] as const;

export function useSubjects() {
  return useQuery({
    queryKey: subjectsQueryKey,
    queryFn: () => getJson<SubjectListResponse>('/subjects'),
    select: (response) => response.subjects,
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => {
      const createSubjectRequest: CreateSubjectRequest = { name };
      return postJson<CreateSubjectResponse>('/subjects', createSubjectRequest);
    },
    onSuccess: ({ subject }) => {
      queryClient.setQueryData<SubjectListResponse>(subjectsQueryKey, (current) =>
        current ? { subjects: sortByName([...current.subjects, subject]) } : current,
      );
      return queryClient.invalidateQueries({ queryKey: subjectsQueryKey });
    },
  });
}

function sortByName(subjects: Subject[]): Subject[] {
  return subjects.sort((first, second) =>
    first.name.localeCompare(second.name, undefined, { sensitivity: 'base' }),
  );
}
