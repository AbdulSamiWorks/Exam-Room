import { useSyncExternalStore } from 'react';
import { ApiError } from '../../../api/http-client';
import { deleteRecord, listRecordKeys, readRecord, writeRecord } from '../../../lib/durable-store';
import { createRandomId } from '../../../lib/random-id';
import { uploadAnswerPhoto } from '../student-api';
import { retryDelayMs } from '../answers/outbox-state';
import type { SendingState } from '../answers/outbox-store';

export type PendingPhoto = {
  clientPhotoId: string;
  testCode: string;
  attemptToken: string;
  photo: Blob;
};

export type PhotoOutboxSnapshot = {
  pending: PendingPhoto[];
  sendingState: SendingState;
  problems: string[];
};

export type PhotoOutboxDependencies = {
  upload: (photo: PendingPhoto) => Promise<unknown>;
  storage: {
    read: (key: string) => Promise<PendingPhoto | undefined>;
    write: (key: string, photo: PendingPhoto) => Promise<void>;
    remove: (key: string) => Promise<void>;
    listKeys: (prefix: string) => Promise<string[]>;
  };
  random: () => number;
  createId: () => string;
};

const RECORD_PREFIX = 'photo:';
const EMPTY_SNAPSHOT: PhotoOutboxSnapshot = { pending: [], sendingState: 'saved', problems: [] };
const UNAUTHORIZED_STATUS = 401;
const RETRY_LATER_STATUSES = new Set([408, 429]);

export function createPhotoOutbox(dependencies: PhotoOutboxDependencies) {
  const { storage } = dependencies;
  const snapshots = new Map<string, PhotoOutboxSnapshot>();
  const listeners = new Set<() => void>();
  const sending = new Set<string>();
  const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const failureCounts = new Map<string, number>();

  function recordKey(photo: Pick<PendingPhoto, 'testCode' | 'clientPhotoId'>): string {
    return `${RECORD_PREFIX}${photo.testCode}:${photo.clientPhotoId}`;
  }

  function update(
    testCode: string,
    change: (snapshot: PhotoOutboxSnapshot) => PhotoOutboxSnapshot,
  ) {
    snapshots.set(testCode, change(snapshots.get(testCode) ?? EMPTY_SNAPSHOT));
    for (const listener of listeners) listener();
  }

  function isPermanentFailure(error: unknown): boolean {
    return (
      error instanceof ApiError &&
      error.isClientError &&
      error.status !== UNAUTHORIZED_STATUS &&
      !RETRY_LATER_STATUSES.has(error.status)
    );
  }

  async function sendPending(testCode: string): Promise<void> {
    if (sending.has(testCode)) return;
    sending.add(testCode);
    clearTimeout(retryTimers.get(testCode));
    try {
      for (;;) {
        const [photo] = snapshots.get(testCode)?.pending ?? [];
        if (!photo) break;
        update(testCode, (snapshot) => ({ ...snapshot, sendingState: 'saving' }));
        try {
          await dependencies.upload(photo);
        } catch (error) {
          if (!isPermanentFailure(error)) throw error;
          const message = error instanceof Error ? error.message : 'A photo was not accepted.';
          update(testCode, (snapshot) => ({
            ...snapshot,
            problems: [...snapshot.problems, message],
          }));
        }
        await storage.remove(recordKey(photo)).catch(() => undefined);
        update(testCode, (snapshot) => ({
          ...snapshot,
          pending: snapshot.pending.filter((item) => item.clientPhotoId !== photo.clientPhotoId),
        }));
      }
      failureCounts.delete(testCode);
      update(testCode, (snapshot) => ({ ...snapshot, sendingState: 'saved' }));
    } catch (error) {
      const isLoggedOut = error instanceof ApiError && error.status === UNAUTHORIZED_STATUS;
      update(testCode, (snapshot) => ({
        ...snapshot,
        sendingState: isLoggedOut ? 'session_lost' : 'offline',
      }));
      if (!isLoggedOut) {
        const failureCount = (failureCounts.get(testCode) ?? 0) + 1;
        failureCounts.set(testCode, failureCount);
        retryTimers.set(
          testCode,
          setTimeout(
            () => void sendPending(testCode),
            retryDelayMs(failureCount, dependencies.random()),
          ),
        );
      }
    } finally {
      sending.delete(testCode);
    }
  }

  async function addPhoto(testCode: string, attemptToken: string, photo: Blob): Promise<void> {
    const pendingPhoto: PendingPhoto = {
      clientPhotoId: dependencies.createId(),
      testCode,
      attemptToken,
      photo,
    };
    update(testCode, (snapshot) => ({ ...snapshot, pending: [...snapshot.pending, pendingPhoto] }));
    await storage.write(recordKey(pendingPhoto), pendingPhoto).catch(() => undefined);
    void sendPending(testCode);
  }

  async function resumeStoredPhotos(): Promise<void> {
    for (const key of await storage.listKeys(RECORD_PREFIX)) {
      const photo = await storage.read(key);
      if (!photo || !(photo.photo instanceof Blob)) continue;
      const isKnown = snapshots
        .get(photo.testCode)
        ?.pending.some((item) => item.clientPhotoId === photo.clientPhotoId);
      if (!isKnown) {
        update(photo.testCode, (snapshot) => ({
          ...snapshot,
          pending: [...snapshot.pending, photo],
        }));
      }
    }
    for (const testCode of snapshots.keys()) void sendPending(testCode);
  }

  function hasPendingPhotos(): boolean {
    return [...snapshots.values()].some(
      (snapshot) => snapshot.sendingState !== 'session_lost' && snapshot.pending.length > 0,
    );
  }

  async function forgetEverything(): Promise<void> {
    for (const timer of retryTimers.values()) clearTimeout(timer);
    retryTimers.clear();
    failureCounts.clear();
    snapshots.clear();
    for (const listener of listeners) listener();
    for (const key of await storage.listKeys(RECORD_PREFIX)) {
      await storage.remove(key).catch(() => undefined);
    }
  }

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshotOf: (testCode: string) => snapshots.get(testCode) ?? EMPTY_SNAPSHOT,
    addPhoto,
    hasPendingPhotos,
    forgetEverything,
    sendAllNow: () => {
      for (const testCode of snapshots.keys()) void sendPending(testCode);
    },
    resumeStoredPhotos,
  };
}

const photoOutbox = createPhotoOutbox({
  upload: (photo) => uploadAnswerPhoto(photo.attemptToken, photo.clientPhotoId, photo.photo),
  storage: {
    read: (key) => readRecord<PendingPhoto>(key),
    write: (key, photo) => writeRecord(key, photo),
    remove: deleteRecord,
    listKeys: listRecordKeys,
  },
  random: Math.random,
  createId: createRandomId,
});

export const { addPhoto, hasPendingPhotos } = photoOutbox;
export const forgetAllPendingPhotos = photoOutbox.forgetEverything;

export function usePhotoOutbox(testCode: string): PhotoOutboxSnapshot {
  return useSyncExternalStore(photoOutbox.subscribe, () => photoOutbox.snapshotOf(testCode));
}

export function startPhotoOutbox(): void {
  window.addEventListener('online', photoOutbox.sendAllNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') photoOutbox.sendAllNow();
  });
  void photoOutbox.resumeStoredPhotos();
}
