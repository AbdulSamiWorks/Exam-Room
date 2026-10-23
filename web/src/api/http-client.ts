import type { ApiErrorBody } from '@exam-room/shared';

const API_BASE_PATH = '/api';
const NETWORK_ERROR_STATUS = 0;

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
};

export function getJson<ResponseBody>(
  path: string,
  options: RequestOptions = {},
): Promise<ResponseBody> {
  return requestJson<ResponseBody>(path, { method: 'GET', headers: options.headers });
}

export function postJson<ResponseBody>(
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<ResponseBody> {
  return requestJson<ResponseBody>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    keepalive: options.keepalive,
  });
}

export function putJson<ResponseBody>(path: string, body: unknown): Promise<ResponseBody> {
  return requestJson<ResponseBody>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteResource(path: string): Promise<void> {
  const response = await sendRequest(path, { method: 'DELETE' });
  if (!response.ok) throw await readApiError(response);
}

export async function getBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const response = await sendRequest(path, { method: 'GET', headers: options.headers });
  if (!response.ok) throw await readApiError(response);
  return response.blob();
}

export function postForm<ResponseBody>(path: string, formData: FormData): Promise<ResponseBody> {
  return requestJson<ResponseBody>(path, { method: 'POST', body: formData });
}

async function requestJson<ResponseBody>(path: string, init: RequestInit): Promise<ResponseBody> {
  const response = await sendRequest(path, init);
  if (!response.ok) throw await readApiError(response);
  return (await response.json()) as ResponseBody;
}

async function sendRequest(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE_PATH}${path}`, init);
  } catch {
    throw new ApiError(
      NETWORK_ERROR_STATUS,
      'network_error',
      'No internet connection. Please check your connection and try again.',
    );
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
