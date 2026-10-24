import { LibsqlError } from '@libsql/client';

const TRANSIENT_ERROR_CODES = new Set([
  'SQLITE_BUSY',
  'SQLITE_LOCKED',
  'SERVER_ERROR',
  'HRANA_WEBSOCKET_ERROR',
  'HRANA_CLOSED_ERROR',
]);
const TRANSIENT_NETWORK_MESSAGE = /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up/i;
const RETRY_DELAYS_MS = [150, 450];

export type Wait = (milliseconds: number) => Promise<void>;

const waitFor: Wait = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

export function isTransientDatabaseError(error: unknown): boolean {
  if (error instanceof LibsqlError) return TRANSIENT_ERROR_CODES.has(error.code);
  return error instanceof Error && TRANSIENT_NETWORK_MESSAGE.test(error.message);
}

export async function retryTransientErrors<Result>(
  operation: () => Promise<Result>,
  wait: Wait = waitFor,
): Promise<Result> {
  for (const delayMs of RETRY_DELAYS_MS) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientDatabaseError(error)) throw error;
      await wait(delayMs);
    }
  }
  return operation();
}
