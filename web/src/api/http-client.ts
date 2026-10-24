import type { ApiErrorBody } from '@exam-room/shared';
import { retryDelayFor, shouldTryAgain, type FinishedTry } from './request-retry';
import { watchRequest } from './server-wait';

const API_BASE_PATH = '/api';
const NETWORK_ERROR_STATUS = 0;
const NO_CONTENT_STATUS = 204;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

export type RequestOptions = {
  headers?: Record<string, string>;
  keepalive?: boolean;
  waitForServer?: boolean;
  repeatable?: boolean;
};

export function getJson<ResponseBody>(
  path: string,
  options: RequestOptions = {},
): Promise<ResponseBody> {
  return requestJson<ResponseBody>(path, { method: 'GET', headers: options.headers }, options);
}

export function postJson<ResponseBody>(
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<ResponseBody> {
  return requestJson<ResponseBody>(path, jsonRequest('POST', body, options), options);
}

export function putJson<ResponseBody>(
  path: string,
  body: unknown,
  options: RequestOptions = {},
): Promise<ResponseBody> {
  return requestJson<ResponseBody>(path, jsonRequest('PUT', body, options), options);
}

export function patchJson<ResponseBody>(
  path: string,
  body: unknown,
  options: RequestOptions = {},
): Promise<ResponseBody> {
  return requestJson<ResponseBody>(path, jsonRequest('PATCH', body, options), options);
}

function jsonRequest(method: string, body: unknown, options: RequestOptions): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    keepalive: options.keepalive,
  };
}

export async function deleteResource(path: string, options: RequestOptions = {}): Promise<void> {
  const response = await sendRequest(path, { method: 'DELETE', headers: options.headers }, options);
  if (!response.ok) throw await readApiError(response);
}

export async function getBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const response = await sendRequest(path, { method: 'GET', headers: options.headers }, options);
  if (!response.ok) throw await readApiError(response);
  return response.blob();
}

export function postForm<ResponseBody>(path: string, formData: FormData): Promise<ResponseBody> {
  return requestJson<ResponseBody>(path, { method: 'POST', body: formData }, {});
}

export function putBlob<ResponseBody>(
  path: string,
  blob: Blob,
  options: RequestOptions = {},
): Promise<ResponseBody> {
  return requestJson<ResponseBody>(
    path,
    { method: 'PUT', headers: { 'Content-Type': blob.type, ...options.headers }, body: blob },
    options,
  );
}

export function putForm<ResponseBody>(path: string, formData: FormData): Promise<ResponseBody> {
  return requestJson<ResponseBody>(path, { method: 'PUT', body: formData }, {});
}

async function requestJson<ResponseBody>(
  path: string,
  init: RequestInit,
  options: RequestOptions,
): Promise<ResponseBody> {
  const response = await sendRequest(path, init, options);
  if (!response.ok) throw await readApiError(response);
  if (response.status === NO_CONTENT_STATUS) return undefined as ResponseBody;
  return (await response.json()) as ResponseBody;
}

function networkError(): ApiError {
  return new ApiError(
    NETWORK_ERROR_STATUS,
    'network_error',
    'The server cannot be reached. Check your internet connection and try again.',
  );
}

function waitFor(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function sendRequest(
  path: string,
  init: RequestInit,
  { waitForServer = true, repeatable = false }: RequestOptions,
): Promise<Response> {
  const url = `${API_BASE_PATH}${path}`;
  if (!waitForServer) {
    const response = await fetch(url, init).catch(() => undefined);
    if (!response) throw networkError();
    return response;
  }

  const startedAt = Date.now();
  const watchedRequest = watchRequest();
  try {
    for (let tryNumber = 1; ; tryNumber += 1) {
      const response = await fetch(url, init).catch(() => undefined);
      const finishedTry: FinishedTry = {
        method: init.method ?? 'GET',
        isMarkedRepeatable: repeatable,
        status: response?.status,
        wasOffline: !navigator.onLine,
        elapsedMs: Date.now() - startedAt,
      };
      if (!shouldTryAgain(finishedTry)) {
        if (response) return response;
        throw networkError();
      }
      watchedRequest.markWaiting();
      await waitFor(retryDelayFor(tryNumber));
    }
  } finally {
    watchedRequest.finish();
  }
}

async function readApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
  return new ApiError(
    response.status,
    body?.error.code ?? 'request_failed',
    body?.error.message ?? 'Something went wrong. Please try again.',
  );
}
