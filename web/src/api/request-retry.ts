export const WAIT_FOR_SERVER_MS = 120_000;

const RETRY_DELAY_STEP_MS = 1000;
const LONGEST_RETRY_DELAY_MS = 5000;
const SERVER_STARTING_STATUSES: ReadonlySet<number> = new Set([502, 503]);
const GATEWAY_TIMEOUT_STATUS = 504;
const REPEATABLE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE']);

export type FinishedTry = {
  method: string;
  isMarkedRepeatable: boolean;
  status: number | undefined;
  wasOffline: boolean;
  elapsedMs: number;
};

export function canRepeatSafely(method: string, isMarkedRepeatable: boolean): boolean {
  return isMarkedRepeatable || REPEATABLE_METHODS.has(method.toUpperCase());
}

export function shouldTryAgain(finishedTry: FinishedTry): boolean {
  if (finishedTry.elapsedMs >= WAIT_FOR_SERVER_MS) return false;
  const { status } = finishedTry;
  if (status !== undefined && SERVER_STARTING_STATUSES.has(status)) return true;
  const isRepeatable = canRepeatSafely(finishedTry.method, finishedTry.isMarkedRepeatable);
  if (status === GATEWAY_TIMEOUT_STATUS) return isRepeatable;
  if (status === undefined) return isRepeatable || finishedTry.wasOffline;
  return false;
}

export function retryDelayFor(tryNumber: number): number {
  return Math.min(RETRY_DELAY_STEP_MS * tryNumber, LONGEST_RETRY_DELAY_MS);
}
