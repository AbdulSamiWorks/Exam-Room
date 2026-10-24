import type { WrittenAnswers } from '@exam-room/shared';
import type { AttemptRecord } from '../attempts/attempt-record.js';
import { photoLimits } from './photo-limits.js';

const MILLISECONDS_PER_MINUTE = 60_000;
const PHOTO_ANSWERS: ReadonlySet<WrittenAnswers> = new Set(['photos', 'typed_and_photos']);
const ACCEPTED_FORMATS = new Set(['jpeg', 'webp', 'png']);
const MIN_PHOTO_SIDE_PX = 200;
const MAX_PHOTO_SIDE_PX = 4000;

export type PhotoMetadata = {
  format: string | undefined;
  width: number | undefined;
  height: number | undefined;
};

export function takesPhotoAnswers(writtenAnswers: WrittenAnswers): boolean {
  return PHOTO_ANSWERS.has(writtenAnswers);
}

export function photosOpenUntil(
  attempt: Pick<AttemptRecord, 'status' | 'finishedAt'>,
): number | null {
  if (attempt.status !== 'submitted' || attempt.finishedAt === null) return null;
  return attempt.finishedAt + photoLimits.photoWindowMinutes * MILLISECONDS_PER_MINUTE;
}

export function photoWindowProblem(
  attempt: Pick<AttemptRecord, 'status' | 'finishedAt'>,
  currentTime: number,
): string | undefined {
  const openUntil = photosOpenUntil(attempt);
  if (openUntil === null) return 'Finish the test first, then add the photos.';
  if (currentTime > openUntil) {
    return `Photos can be added for ${photoLimits.photoWindowMinutes} minutes after the test.`;
  }
  return undefined;
}

export function photoFileProblem({ format, width, height }: PhotoMetadata): string | undefined {
  if (!format || !ACCEPTED_FORMATS.has(format))
    return 'The photo must be a JPEG, WebP or PNG image.';
  if (!width || !height) return 'The photo could not be read.';
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  if (shortSide < MIN_PHOTO_SIDE_PX) return 'The photo is too small to read.';
  if (longSide > MAX_PHOTO_SIDE_PX) return 'The photo is too large. Take it again.';
  return undefined;
}
