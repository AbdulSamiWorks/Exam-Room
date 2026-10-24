import type { AnswerChange, AttemptResponse, StoredAnswer } from '@exam-room/shared';
import { useSyncExternalStore } from 'react';
import { ApiError } from '../../../api/http-client';
import { deleteRecord, listRecordKeys, readRecord, writeRecord } from '../../../lib/durable-store';
import { finishAttempt, sendAnswers } from '../student-api';
import {
  emptyOutbox,
  hasUnsentWork,
  nextBatch,
  retryDelayMs,
  withAnswer,
  withSentBatch,
  withServerAnswers,
  type AnswerValue,
  type AttemptOutbox,
} from './outbox-state';

export type SendingState = 'saved' | 'saving' | 'offline' | 'session_lost';

export type OutboxSnapshot = {
  outbox: AttemptOutbox;
  sendingState: SendingState;
};

type FinishListener = (testCode: string, response: AttemptResponse) => void;

export type OutboxStorage = {
  read: (key: string) => Promise<AttemptOutbox | undefined>;
  write: (key: string, outbox: AttemptOutbox) => Promise<void>;
  remove: (key: string) => Promise<void>;
  listKeys: (prefix: string) => Promise<string[]>;
};

export type OutboxDependencies = {
  sendAnswers: (attemptToken: string, answers: AnswerChange[]) => Promise<{ tooLateCount: number }>;
  finishAttempt: (attemptToken: string) => Promise<AttemptResponse>;
  storage: OutboxStorage;
  now: () => number;
  random: () => number;
};

const RECORD_PREFIX = 'outbox:';
const MAX_ANSWERS_PER_BATCH = 50;
const UNAUTHORIZED_STATUS = 401;
const BAD_REQUEST_STATUS = 400;

export function createOutboxStore(dependencies: OutboxDependencies) {
  const { storage } = dependencies;
  const snapshots = new Map<string, OutboxSnapshot>();
  const listeners = new Set<() => void>();
  const finishListeners = new Set<FinishListener>();
  const failureCounts = new Map<string, number>();
  const sendTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const flushingTestCodes = new Set<string>();
  const flushAgainTestCodes = new Set<string>();
  const serverClockOffsets = new Map<string, number>();
  let savingQueue: Promise<void> = Promise.resolve();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function recordKey(testCode: string): string {
    return `${RECORD_PREFIX}${testCode}`;
  }

  function persist(outbox: AttemptOutbox): void {
    savingQueue = savingQueue
      .then(() => storage.write(recordKey(outbox.testCode), outbox))
      .catch(() => undefined);
  }

  function setSnapshot(testCode: string, snapshot: OutboxSnapshot): void {
    snapshots.set(testCode, snapshot);
    notify();
  }

  function updateOutbox(testCode: string, change: (outbox: AttemptOutbox) => AttemptOutbox): void {
    const snapshot = snapshots.get(testCode);
    if (!snapshot) return;
    const outbox = change(snapshot.outbox);
    setSnapshot(testCode, { ...snapshot, outbox });
    persist(outbox);
  }

  function setSendingState(testCode: string, sendingState: SendingState): void {
    const snapshot = snapshots.get(testCode);
    if (snapshot && snapshot.sendingState !== sendingState) {
      setSnapshot(testCode, { ...snapshot, sendingState });
    }
  }

  function scheduleFlush(testCode: string, delayMs: number): void {
    clearTimeout(sendTimers.get(testCode));
    sendTimers.set(
      testCode,
      setTimeout(() => void flush(testCode), delayMs),
    );
  }

  async function flush(testCode: string): Promise<void> {
    if (flushingTestCodes.has(testCode)) {
      flushAgainTestCodes.add(testCode);
      return;
    }
    flushingTestCodes.add(testCode);
    clearTimeout(sendTimers.get(testCode));

    try {
      await sendEverything(testCode);
      failureCounts.delete(testCode);
      setSendingState(testCode, 'saved');
    } catch (error) {
      handleSendFailure(testCode, error);
    } finally {
      flushingTestCodes.delete(testCode);
      if (flushAgainTestCodes.delete(testCode)) void flush(testCode);
    }
  }

  async function sendEverything(testCode: string): Promise<void> {
    for (;;) {
      const outbox = snapshots.get(testCode)?.outbox;
      if (!outbox) return;

      const batch = nextBatch(outbox, MAX_ANSWERS_PER_BATCH);
      if (batch.length > 0) {
        setSendingState(testCode, 'saving');
        const { tooLateCount } = await dependencies
          .sendAnswers(outbox.attemptToken, batch)
          .catch((error: unknown) => {
            if (error instanceof ApiError && error.status === BAD_REQUEST_STATUS) {
              return { tooLateCount: batch.length };
            }
            throw error;
          });
        updateOutbox(testCode, (current) => withSentBatch(current, batch, tooLateCount));
        continue;
      }

      if (outbox.finishRequested && !outbox.finishSent) {
        setSendingState(testCode, 'saving');
        const response = await dependencies.finishAttempt(outbox.attemptToken);
        updateOutbox(testCode, (current) => ({ ...current, finishSent: true }));
        for (const listener of finishListeners) listener(testCode, response);
        continue;
      }
      return;
    }
  }

  function handleSendFailure(testCode: string, error: unknown): void {
    if (error instanceof ApiError && error.status === UNAUTHORIZED_STATUS) {
      setSendingState(testCode, 'session_lost');
      return;
    }
    const failureCount = (failureCounts.get(testCode) ?? 0) + 1;
    failureCounts.set(testCode, failureCount);
    setSendingState(testCode, 'offline');
    scheduleFlush(testCode, retryDelayMs(failureCount, dependencies.random()));
  }

  async function loadOutbox(testCode: string, attemptToken: string): Promise<void> {
    const known = snapshots.get(testCode);
    if (known?.outbox.attemptToken === attemptToken) return;
    const stored = known?.outbox ?? (await storage.read(recordKey(testCode)));
    const outbox = stored ? { ...stored, attemptToken } : emptyOutbox(testCode, attemptToken);
    setSnapshot(testCode, { outbox, sendingState: hasUnsentWork(outbox) ? 'saving' : 'saved' });
    persist(outbox);
    if (hasUnsentWork(outbox)) void flush(testCode);
  }

  function setServerClock(testCode: string, serverTime: number, receivedAt: number): void {
    serverClockOffsets.set(testCode, serverTime - receivedAt);
  }

  function recordAnswer(
    testCode: string,
    questionId: string,
    value: AnswerValue,
    sendAfterMs = 0,
  ): void {
    const answeredAt = dependencies.now() + (serverClockOffsets.get(testCode) ?? 0);
    updateOutbox(testCode, (outbox) => withAnswer(outbox, questionId, value, answeredAt));
    setSendingState(testCode, 'saving');
    scheduleFlush(testCode, sendAfterMs);
  }

  function mergeServerAnswers(
    testCode: string,
    answers: readonly StoredAnswer[],
    serverTime: number,
  ): void {
    updateOutbox(testCode, (outbox) => withServerAnswers(outbox, answers, serverTime));
  }

  function requestFinish(testCode: string): void {
    updateOutbox(testCode, (outbox) => ({ ...outbox, finishRequested: true }));
    setSendingState(testCode, 'saving');
    scheduleFlush(testCode, 0);
  }

  function onFinished(listener: FinishListener): () => void {
    finishListeners.add(listener);
    return () => finishListeners.delete(listener);
  }

  async function forgetOutbox(testCode: string): Promise<void> {
    const snapshot = snapshots.get(testCode);
    if (snapshot && hasUnsentWork(snapshot.outbox)) return;
    snapshots.delete(testCode);
    notify();
    await savingQueue;
    await storage.remove(recordKey(testCode));
  }

  function sendAllNow(): void {
    for (const [testCode, snapshot] of snapshots) {
      if (hasUnsentWork(snapshot.outbox)) scheduleFlush(testCode, 0);
    }
  }

  async function resumeStoredOutboxes(): Promise<void> {
    for (const key of await storage.listKeys(RECORD_PREFIX)) {
      const outbox = await storage.read(key);
      if (outbox && hasUnsentWork(outbox) && !snapshots.has(outbox.testCode)) {
        await loadOutbox(outbox.testCode, outbox.attemptToken);
      }
    }
  }

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshotOf: (testCode: string) => snapshots.get(testCode),
    whenSaved: () => savingQueue,
    loadOutbox,
    setServerClock,
    recordAnswer,
    mergeServerAnswers,
    requestFinish,
    onFinished,
    forgetOutbox,
    sendAllNow,
    resumeStoredOutboxes,
  };
}

const browserStorage: OutboxStorage = {
  read: (key) => readRecord<AttemptOutbox>(key),
  write: (key, outbox) => writeRecord(key, outbox),
  remove: deleteRecord,
  listKeys: listRecordKeys,
};

const outboxStore = createOutboxStore({
  sendAnswers,
  finishAttempt,
  storage: browserStorage,
  now: Date.now,
  random: Math.random,
});

export const {
  loadOutbox,
  setServerClock,
  recordAnswer,
  mergeServerAnswers,
  requestFinish,
  onFinished,
  forgetOutbox,
} = outboxStore;

export function useOutbox(testCode: string): OutboxSnapshot | undefined {
  return useSyncExternalStore(outboxStore.subscribe, () => outboxStore.snapshotOf(testCode));
}

export function startAnswerOutboxes(): void {
  window.addEventListener('online', outboxStore.sendAllNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') outboxStore.sendAllNow();
  });
  void outboxStore.resumeStoredOutboxes();
}
