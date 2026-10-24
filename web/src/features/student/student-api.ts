import type {
  AnswerPhotoListResponse,
  AttemptResponse,
  PublicTestResponse,
  SaveAnswerPhotoResponse,
  RecordExitRequest,
  RecordReturnRequest,
  SaveAnswersRequest,
  SaveAnswersResponse,
  StartAttemptResponse,
  StoredAnswersResponse,
  StudentPaperResponse,
} from '@exam-room/shared';
import {
  deleteResource,
  getBlob,
  getJson,
  postJson,
  putBlob,
  type RequestOptions,
} from '../../api/http-client';

const OUTBOX_REQUEST: RequestOptions = { waitForServer: false };

function withAttemptToken(attemptToken: string, options: RequestOptions = {}): RequestOptions {
  return { ...options, headers: { Authorization: `Bearer ${attemptToken}` } };
}

export function fetchPublicTest(testCode: string): Promise<PublicTestResponse> {
  return getJson<PublicTestResponse>(`/public/tests/${encodeURIComponent(testCode)}`);
}

export function startAttempt(testCode: string): Promise<StartAttemptResponse> {
  return postJson<StartAttemptResponse>(`/public/tests/${encodeURIComponent(testCode)}/attempts`);
}

export function fetchAttempt(attemptToken: string): Promise<AttemptResponse> {
  return getJson<AttemptResponse>('/attempt', withAttemptToken(attemptToken));
}

export function fetchPageImage(attemptToken: string, pageNumber: number): Promise<Blob> {
  return getBlob(`/attempt/pages/${pageNumber}`, withAttemptToken(attemptToken));
}

export function fetchPaperPicture(attemptToken: string, imageNumber: number): Promise<Blob> {
  return getBlob(`/attempt/paper-images/${imageNumber}`, withAttemptToken(attemptToken));
}

export function fetchStudentPaper(attemptToken: string): Promise<StudentPaperResponse> {
  return getJson<StudentPaperResponse>('/attempt/paper', withAttemptToken(attemptToken));
}

export function sendAnswers(
  attemptToken: string,
  answers: SaveAnswersRequest['answers'],
): Promise<SaveAnswersResponse> {
  return postJson<SaveAnswersResponse>(
    '/attempt/answers',
    { answers } satisfies SaveAnswersRequest,
    withAttemptToken(attemptToken, OUTBOX_REQUEST),
  );
}

export function fetchSavedAnswers(attemptToken: string): Promise<StoredAnswersResponse> {
  return getJson<StoredAnswersResponse>('/attempt/answers', withAttemptToken(attemptToken));
}

export function reportExit(
  attemptToken: string,
  exitReport: RecordExitRequest,
): Promise<AttemptResponse> {
  return postJson<AttemptResponse>(
    '/attempt/exits',
    exitReport,
    withAttemptToken(attemptToken, { ...OUTBOX_REQUEST, keepalive: true }),
  );
}

export function reportReturn(
  attemptToken: string,
  returnReport: RecordReturnRequest,
): Promise<AttemptResponse> {
  return postJson<AttemptResponse>(
    '/attempt/return',
    returnReport,
    withAttemptToken(attemptToken, OUTBOX_REQUEST),
  );
}

export function finishAttempt(attemptToken: string): Promise<AttemptResponse> {
  return postJson<AttemptResponse>(
    '/attempt/finish',
    undefined,
    withAttemptToken(attemptToken, OUTBOX_REQUEST),
  );
}

export function fetchAnswerPhotos(attemptToken: string): Promise<AnswerPhotoListResponse> {
  return getJson<AnswerPhotoListResponse>('/attempt/photos', withAttemptToken(attemptToken));
}

export function uploadAnswerPhoto(
  attemptToken: string,
  clientPhotoId: string,
  photo: Blob,
): Promise<SaveAnswerPhotoResponse> {
  return putBlob<SaveAnswerPhotoResponse>(
    `/attempt/photos/${clientPhotoId}`,
    photo,
    withAttemptToken(attemptToken, OUTBOX_REQUEST),
  );
}

export function removeAnswerPhoto(attemptToken: string, clientPhotoId: string): Promise<void> {
  return deleteResource(`/attempt/photos/${clientPhotoId}`, withAttemptToken(attemptToken));
}
