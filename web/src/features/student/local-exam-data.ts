import { forgetAllOutboxes, hasUnsentAnswers } from './answers/outbox-store';
import { forgetAllStoredAttempts } from './attempt-storage';
import { forgetAllPendingPhotos, hasPendingPhotos } from './photos/photo-outbox';

export function hasUnsentExamWork(): boolean {
  return hasUnsentAnswers() || hasPendingPhotos();
}

export async function forgetLocalExamData(): Promise<void> {
  forgetAllStoredAttempts();
  await Promise.all([forgetAllOutboxes(), forgetAllPendingPhotos()]);
}
