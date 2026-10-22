import type { ApiErrorBody } from '@exam-room/shared';
import type { ErrorRequestHandler } from 'express';
import { HttpError } from './http-errors.js';

const PAYLOAD_TOO_LARGE_STATUS = 413;

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) return next(error);

  const httpError = toHttpError(error);
  if (httpError.status >= 500) console.error(error);

  const body: ApiErrorBody = { error: { code: httpError.code, message: httpError.message } };
  response.status(httpError.status).json(body);
};

function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;

  const clientErrorStatus = readClientErrorStatus(error);
  if (clientErrorStatus === PAYLOAD_TOO_LARGE_STATUS) {
    return new HttpError(clientErrorStatus, 'payload_too_large', 'The upload is too large.');
  }
  if (clientErrorStatus !== undefined) {
    return new HttpError(clientErrorStatus, 'bad_request', 'Bad request.');
  }

  return new HttpError(500, 'internal', 'Something went wrong. Please try again.');
}

function readClientErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  const status = Number(error.status);
  return status >= 400 && status < 500 ? status : undefined;
}
