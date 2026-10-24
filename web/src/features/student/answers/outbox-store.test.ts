import type { AnswerChange, AttemptResponse } from '@exam-room/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/http-client';
import { createOutboxStore, type OutboxDependencies, type OutboxStorage } from './outbox-store';
import type { AttemptOutbox } from './outbox-state';

const TEST_CODE = 'K7M2QX';
const FINISHED = { attempt: { status: 'submitted' } } as AttemptResponse;

function memoryStorage(): OutboxStorage & { records: Map<string, AttemptOutbox> } {
  const records = new Map<string, AttemptOutbox>();
  return {
    records,
    read: (key) => Promise.resolve(records.get(key)),
    write: (key, outbox) => {
      records.set(key, structuredClone(outbox));
      return Promise.resolve();
    },
    remove: (key) => {
      records.delete(key);
      return Promise.resolve();
    },
    listKeys: (prefix) =>
      Promise.resolve([...records.keys()].filter((key) => key.startsWith(prefix))),
  };
}

type FakeServer = {
  isAwake: boolean;
  received: AnswerChange[][];
  finishCount: number;
  calls: string[];
};

function fakeServer(): FakeServer {
  return { isAwake: true, received: [], finishCount: 0, calls: [] };
}

function storeWith(server: FakeServer, storage: OutboxStorage) {
  const offline = () => new ApiError(0, 'network_error', 'No internet connection.');
  const dependencies: OutboxDependencies = {
    sendAnswers: (_token, answers) => {
      server.calls.push('answers');
      if (!server.isAwake) return Promise.reject(offline());
      server.received.push(answers);
      return Promise.resolve({ tooLateCount: 0 });
    },
    finishAttempt: () => {
      server.calls.push('finish');
      if (!server.isAwake) return Promise.reject(offline());
      server.finishCount += 1;
      return Promise.resolve(FINISHED);
    },
    storage,
    now: () => 1000,
    random: () => 1,
  };
  return createOutboxStore(dependencies);
}

async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

describe('the answer outbox on the phone', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends each answer and says it is saved', async () => {
    const server = fakeServer();
    const store = storeWith(server, memoryStorage());
    await store.loadOutbox(TEST_CODE, 'token');

    store.recordAnswer(TEST_CODE, 'q1', { choice: 2, text: null });
    expect(store.snapshotOf(TEST_CODE)?.sendingState).toBe('saving');
    await settle();

    expect(server.received).toEqual([
      [{ questionId: 'q1', choice: 2, text: null, sequence: 1, answeredAt: 1000 }],
    ]);
    expect(store.snapshotOf(TEST_CODE)?.sendingState).toBe('saved');
  });

  it('keeps trying with longer waits while the server sleeps, then sends everything', async () => {
    const server = fakeServer();
    server.isAwake = false;
    const store = storeWith(server, memoryStorage());
    await store.loadOutbox(TEST_CODE, 'token');

    store.recordAnswer(TEST_CODE, 'q1', { choice: 0, text: null });
    store.recordAnswer(TEST_CODE, 'q2', { choice: 1, text: null });
    await settle();
    expect(store.snapshotOf(TEST_CODE)?.sendingState).toBe('offline');

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(server.calls).toEqual(['answers', 'answers', 'answers']);

    server.isAwake = true;
    await vi.advanceTimersByTimeAsync(4000);
    expect(server.received.flat().map((answer) => answer.questionId)).toEqual(['q1', 'q2']);
    expect(store.snapshotOf(TEST_CODE)?.sendingState).toBe('saved');
  });

  it('sends the answers left on a phone that was closed and opened again', async () => {
    const storage = memoryStorage();
    const sleepingServer = fakeServer();
    sleepingServer.isAwake = false;
    const closedApp = storeWith(sleepingServer, storage);
    await closedApp.loadOutbox(TEST_CODE, 'token');
    closedApp.recordAnswer(TEST_CODE, 'q1', { choice: 3, text: null });
    closedApp.requestFinish(TEST_CODE);
    await settle();
    await closedApp.whenSaved();

    const server = fakeServer();
    const reopenedApp = storeWith(server, storage);
    await reopenedApp.resumeStoredOutboxes();
    await settle();

    expect(server.received.flat()).toEqual([
      expect.objectContaining({ questionId: 'q1', choice: 3 }),
    ]);
    expect(server.calls).toEqual(['answers', 'finish']);
  });

  it('sends a changed answer again when it changed while on the way', async () => {
    const server = fakeServer();
    const store = storeWith(server, memoryStorage());
    await store.loadOutbox(TEST_CODE, 'token');

    store.recordAnswer(TEST_CODE, 'q1', { choice: 0, text: null });
    const sending = vi.advanceTimersByTimeAsync(0);
    store.recordAnswer(TEST_CODE, 'q1', { choice: 1, text: null });
    await sending;
    await settle();

    expect(server.received.flat().at(-1)).toMatchObject({ choice: 1, sequence: 2 });
  });

  it('sends Finish only after every answer and tells the screen', async () => {
    const server = fakeServer();
    const store = storeWith(server, memoryStorage());
    const finished = vi.fn();
    store.onFinished(finished);
    await store.loadOutbox(TEST_CODE, 'token');

    store.recordAnswer(TEST_CODE, 'q3', { choice: null, text: 'Typed answer' }, 1500);
    store.requestFinish(TEST_CODE);
    await settle();

    expect(server.calls).toEqual(['answers', 'finish']);
    expect(finished).toHaveBeenCalledWith(TEST_CODE, FINISHED);
  });

  it('stops when the phone was logged out of the test', async () => {
    const store = createOutboxStore({
      sendAnswers: () => Promise.reject(new ApiError(401, 'attempt_not_found', 'Lost.')),
      finishAttempt: () => Promise.resolve(FINISHED),
      storage: memoryStorage(),
      now: () => 0,
      random: () => 0,
    });
    await store.loadOutbox(TEST_CODE, 'old-token');
    store.recordAnswer(TEST_CODE, 'q1', { choice: 0, text: null });
    await settle();
    expect(store.snapshotOf(TEST_CODE)?.sendingState).toBe('session_lost');
  });

  it('reports unsent answers and forgets everything for the next student', async () => {
    const server = fakeServer();
    server.isAwake = false;
    const storage = memoryStorage();
    const store = storeWith(server, storage);
    await store.loadOutbox(TEST_CODE, 'token');
    store.recordAnswer(TEST_CODE, 'q1', { choice: 1, text: null });
    await settle();
    expect(store.hasUnsentWorkAnywhere()).toBe(true);

    await store.forgetEverything();

    expect(store.hasUnsentWorkAnywhere()).toBe(false);
    expect(store.snapshotOf(TEST_CODE)).toBeUndefined();
    expect(storage.records.size).toBe(0);
    server.isAwake = true;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(server.received).toEqual([]);
  });

  it('does not count answers of a removed attempt as unsent', async () => {
    const store = createOutboxStore({
      sendAnswers: () => Promise.reject(new ApiError(401, 'attempt_not_found', 'Lost.')),
      finishAttempt: () => Promise.resolve(FINISHED),
      storage: memoryStorage(),
      now: () => 0,
      random: () => 0,
    });
    await store.loadOutbox(TEST_CODE, 'old-token');
    store.recordAnswer(TEST_CODE, 'q1', { choice: 0, text: null });
    await settle();
    expect(store.hasUnsentWorkAnywhere()).toBe(false);
  });
});
