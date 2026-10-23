import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/http-client';
import { createPhotoOutbox, type PendingPhoto } from './photo-outbox';

function memoryStorage() {
  const records = new Map<string, PendingPhoto>();
  return {
    records,
    read: (key: string) => Promise.resolve(records.get(key)),
    write: (key: string, photo: PendingPhoto) => {
      records.set(key, photo);
      return Promise.resolve();
    },
    remove: (key: string) => {
      records.delete(key);
      return Promise.resolve();
    },
    listKeys: (prefix: string) =>
      Promise.resolve([...records.keys()].filter((key) => key.startsWith(prefix))),
  };
}

describe('the photo outbox', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends photos one by one and retries while the network is down', async () => {
    const uploaded: string[] = [];
    let isOnline = false;
    let photoNumber = 0;
    const storage = memoryStorage();
    const outbox = createPhotoOutbox({
      upload: (photo) => {
        if (!isOnline) return Promise.reject(new ApiError(0, 'network_error', 'Offline.'));
        uploaded.push(photo.clientPhotoId);
        return Promise.resolve();
      },
      storage,
      random: () => 1,
      createId: () => `photo-${(photoNumber += 1)}`,
    });

    await outbox.addPhoto('K7M2QX', 'token', new Blob(['one']));
    await outbox.addPhoto('K7M2QX', 'token', new Blob(['two']));
    await vi.advanceTimersByTimeAsync(0);
    expect(outbox.snapshotOf('K7M2QX').sendingState).toBe('offline');
    expect(storage.records.size).toBe(2);

    isOnline = true;
    await vi.advanceTimersByTimeAsync(2000);
    expect(uploaded).toEqual(['photo-1', 'photo-2']);
    expect(outbox.snapshotOf('K7M2QX')).toMatchObject({ pending: [], sendingState: 'saved' });
    expect(storage.records.size).toBe(0);
  });

  it('sends photos saved on a phone that was closed', async () => {
    const storage = memoryStorage();
    storage.records.set('photo:K7M2QX:photo-9', {
      clientPhotoId: 'photo-9',
      testCode: 'K7M2QX',
      attemptToken: 'token',
      photo: new Blob(['saved']),
    });
    const uploaded: string[] = [];
    const outbox = createPhotoOutbox({
      upload: (photo) => {
        uploaded.push(photo.clientPhotoId);
        return Promise.resolve();
      },
      storage,
      random: () => 0,
      createId: () => 'unused',
    });

    await outbox.resumeStoredPhotos();
    await vi.advanceTimersByTimeAsync(0);
    expect(uploaded).toEqual(['photo-9']);
  });

  it('drops a photo the server refuses and says why', async () => {
    const outbox = createPhotoOutbox({
      upload: () => Promise.reject(new ApiError(409, 'too_many_photos', 'At most 10 photos.')),
      storage: memoryStorage(),
      random: () => 0,
      createId: () => 'photo-1',
    });
    await outbox.addPhoto('K7M2QX', 'token', new Blob(['one']));
    await vi.advanceTimersByTimeAsync(0);
    expect(outbox.snapshotOf('K7M2QX')).toMatchObject({
      pending: [],
      problems: ['At most 10 photos.'],
    });
  });
});
