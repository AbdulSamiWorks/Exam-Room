import type {
  ChapterNameRequest,
  ChapterOrderRequest,
  ChapterResponse,
  ClassListResponse,
  ClassNameRequest,
  ClassResponse,
  CreateSubjectRequest,
  MoveSubjectTestsRequest,
  MoveSubjectTestsResponse,
  SubjectResponse,
  UpdateSubjectRequest,
} from '@exam-room/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteResource, getJson, patchJson, postJson, putJson } from '../../../api/http-client';
import { testQueryKeys } from '../tests/use-tests';

export const classQueryKeys = {
  tree: ['classes'] as const,
  students: (classId: number) => [...classQueryKeys.tree, classId, 'students'] as const,
};

export function useClassTree() {
  return useQuery({
    queryKey: classQueryKeys.tree,
    queryFn: () => getJson<ClassListResponse>('/classes'),
    select: (response) => response.classes,
  });
}

type ManageChangeOptions = {
  changesTests?: boolean;
};

export function useManageChange<Variables, Result>(
  sendChange: (variables: Variables) => Promise<Result>,
  { changesTests = false }: ManageChangeOptions = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendChange,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: classQueryKeys.tree }),
        changesTests && queryClient.invalidateQueries({ queryKey: testQueryKeys.everything }),
      ]),
  });
}

export function useCreateClass() {
  return useManageChange((name: string) =>
    postJson<ClassResponse>('/classes', { name } satisfies ClassNameRequest),
  );
}

export function useRenameClass(classId: number) {
  return useManageChange(
    (name: string) =>
      patchJson<ClassResponse>(`/classes/${classId}`, { name } satisfies ClassNameRequest),
    { changesTests: true },
  );
}

export function useDeleteClass(classId: number) {
  return useManageChange(() => deleteResource(`/classes/${classId}`));
}

export function useCreateSubject(classId: number) {
  return useManageChange((name: string) =>
    postJson<SubjectResponse>(`/classes/${classId}/subjects`, {
      name,
    } satisfies CreateSubjectRequest),
  );
}

export function useUpdateSubject(subjectId: number) {
  return useManageChange(
    (changes: UpdateSubjectRequest) =>
      patchJson<SubjectResponse>(`/subjects/${subjectId}`, changes),
    { changesTests: true },
  );
}

export function useDeleteSubject(subjectId: number) {
  return useManageChange(() => deleteResource(`/subjects/${subjectId}`));
}

export function useMoveSubjectTests(subjectId: number) {
  return useManageChange(
    (toSubjectId: number) =>
      postJson<MoveSubjectTestsResponse>(`/subjects/${subjectId}/move-tests`, {
        toSubjectId,
      } satisfies MoveSubjectTestsRequest),
    { changesTests: true },
  );
}

export function useCreateChapter(subjectId: number) {
  return useManageChange((name: string) =>
    postJson<ChapterResponse>(`/subjects/${subjectId}/chapters`, {
      name,
    } satisfies ChapterNameRequest),
  );
}

export function useRenameChapter(chapterId: number) {
  return useManageChange(
    (name: string) =>
      patchJson<ChapterResponse>(`/chapters/${chapterId}`, { name } satisfies ChapterNameRequest),
    { changesTests: true },
  );
}

export function useDeleteChapter(chapterId: number) {
  return useManageChange(() => deleteResource(`/chapters/${chapterId}`), { changesTests: true });
}

export function useChapterOrder(subjectId: number) {
  return useManageChange(
    (chapterIds: number[]) =>
      putJson<void>(`/subjects/${subjectId}/chapters/order`, {
        chapterIds,
      } satisfies ChapterOrderRequest),
    { changesTests: true },
  );
}
