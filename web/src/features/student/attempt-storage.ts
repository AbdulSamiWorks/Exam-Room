import type { StudentExitReason } from '@exam-room/shared';

export type PendingExit = {
  clientExitId: string;
  reason: StudentExitReason;
  leftAt: number;
};

export type StoredAttempt = {
  attemptToken: string;
  acknowledgedExits: number;
  pendingExit?: PendingExit;
};

const STORAGE_KEY_PREFIX = 'exam-room:attempt:';

function storageKey(testCode: string): string {
  return `${STORAGE_KEY_PREFIX}${testCode}`;
}

export function readStoredAttempt(testCode: string): StoredAttempt | undefined {
  try {
    const storedText = window.localStorage.getItem(storageKey(testCode));
    if (!storedText) return undefined;
    const storedAttempt = JSON.parse(storedText) as Partial<StoredAttempt>;
    if (typeof storedAttempt.attemptToken !== 'string') return undefined;
    return {
      attemptToken: storedAttempt.attemptToken,
      acknowledgedExits: Number(storedAttempt.acknowledgedExits) || 0,
      pendingExit: storedAttempt.pendingExit,
    };
  } catch {
    return undefined;
  }
}

export function saveStoredAttempt(testCode: string, storedAttempt: StoredAttempt): void {
  try {
    window.localStorage.setItem(storageKey(testCode), JSON.stringify(storedAttempt));
  } catch {
    return;
  }
}

export function updateStoredAttempt(testCode: string, changes: Partial<StoredAttempt>): void {
  const storedAttempt = readStoredAttempt(testCode);
  if (storedAttempt) saveStoredAttempt(testCode, { ...storedAttempt, ...changes });
}

export function forgetAllStoredAttempts(): void {
  try {
    const storedKeys = Object.keys(window.localStorage).filter((key) =>
      key.startsWith(STORAGE_KEY_PREFIX),
    );
    for (const key of storedKeys) window.localStorage.removeItem(key);
  } catch {
    return;
  }
}

export function forgetStoredAttempt(testCode: string): void {
  try {
    window.localStorage.removeItem(storageKey(testCode));
  } catch {
    return;
  }
}
