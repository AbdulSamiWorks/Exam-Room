export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string, code = 'bad_request') =>
  new HttpError(400, code, message);

export const unauthorized = (message = 'Please log in first.', code = 'unauthenticated') =>
  new HttpError(401, code, message);

export const notFound = (message = 'Not found.', code = 'not_found') =>
  new HttpError(404, code, message);

export const tooManyRequests = (message: string, code = 'too_many_requests') =>
  new HttpError(429, code, message);
