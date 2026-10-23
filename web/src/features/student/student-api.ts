import type {
  AttemptResponse,
  PublicTestResponse,
  RecordExitRequest,
  RecordReturnRequest,
  StartAttemptResponse,
} from '@exam-room/shared';
import { getBlob, getJson, postJson, type RequestOptions } from '../../api/http-client';

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

export function reportExit(
  attemptToken: string,
  exitReport: RecordExitRequest,
): Promise<AttemptResponse> {
  return postJson<AttemptResponse>(
    '/attempt/exits',
    exitReport,
    withAttemptToken(attemptToken, { keepalive: true }),
  );
}

export function reportReturn(
  attemptToken: string,
  returnReport: RecordReturnRequest,
): Promise<AttemptResponse> {
  return postJson<AttemptResponse>('/attempt/return', returnReport, withAttemptToken(attemptToken));
}

export function finishAttempt(attemptToken: string): Promise<AttemptResponse> {
  return postJson<AttemptResponse>('/attempt/finish', undefined, withAttemptToken(attemptToken));
}
