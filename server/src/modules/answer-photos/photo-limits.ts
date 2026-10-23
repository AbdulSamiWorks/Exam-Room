import type { AnswerPhotoLimits } from '@exam-room/shared';

export const photoLimits: AnswerPhotoLimits = {
  maxPhotos: 10,
  maxPhotoBytes: 3_000_000,
  photoWindowMinutes: 30,
};
