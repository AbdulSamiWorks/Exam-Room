import type {
  AnswerKey,
  AnswerKeyRequest,
  PaperFormField,
  TeacherPaperResponse,
  TestResponse,
} from '@exam-room/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBlob, getJson, putForm, putJson } from '../../../api/http-client';
import { testQueryKeys } from '../tests/use-tests';
import type { PaperUpload } from './paper-upload';

export const paperQueryKeys = {
  paper: (testId: number) => [...testQueryKeys.detail(testId), 'paper'] as const,
};

export function useTeacherPaper(testId: number) {
  return useQuery({
    queryKey: paperQueryKeys.paper(testId),
    queryFn: () => getJson<TeacherPaperResponse>(`/tests/${testId}/paper`),
  });
}

export function useSaveAnswerKey(testId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answerKey: AnswerKey) =>
      putJson<TeacherPaperResponse>(`/tests/${testId}/answer-key`, {
        answerKey,
      } satisfies AnswerKeyRequest),
    onSuccess: (response) => queryClient.setQueryData(paperQueryKeys.paper(testId), response),
  });
}

export function useReplaceTestPaper(testId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (upload: PaperUpload) =>
      putForm<TestResponse>(`/tests/${testId}/paper`, paperFormData(upload)),
    onSuccess: (response) => {
      queryClient.setQueryData(testQueryKeys.detail(testId), response);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: paperQueryKeys.paper(testId) }),
        queryClient.invalidateQueries({ queryKey: testQueryKeys.lists() }),
      ]);
    },
  });
}

export function fetchTeacherPaperImage(testId: number, imageNumber: number): Promise<Blob> {
  return getBlob(`/tests/${testId}/paper-images/${imageNumber}`);
}

export function appendPaperUpload(formData: FormData, upload: PaperUpload): FormData {
  const field = (name: PaperFormField) => name;
  formData.append(field('paper'), JSON.stringify(upload.paper));
  formData.append(field('answerKey'), JSON.stringify(upload.answerKey));
  upload.images.forEach((image, imageIndex) => {
    formData.append(field('paperImages'), image, `picture-${imageIndex + 1}.webp`);
  });
  return formData;
}

function paperFormData(upload: PaperUpload): FormData {
  return appendPaperUpload(new FormData(), upload);
}
