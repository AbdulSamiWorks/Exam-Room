import type { AnswerPhotoListResponse, SaveAnswerPhotoResponse } from '@exam-room/shared';
import express, { Router } from 'express';
import sharp from 'sharp';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import { isUniqueConstraintError } from '../../database/query-helpers.js';
import { retryTransientErrors } from '../../database/transient-errors.js';
import { badRequest, conflict, forbidden, HttpError } from '../../lib/http-errors.js';
import { parseInput } from '../../lib/parse-input.js';
import { loadAttemptOfRequest } from '../attempts/attempt-access.js';
import type { AttemptRecord } from '../attempts/attempt-record.js';
import { findTestOfAttempt } from '../attempts/student-attempt-view.js';
import { photoLimits } from './photo-limits.js';
import {
  photoFileProblem,
  photosOpenUntil,
  photoWindowProblem,
  takesPhotoAnswers,
  type PhotoMetadata,
} from './photo-rules.js';
import {
  deletePhoto,
  findPhotoByClientId,
  insertPhotoIfRoom,
  listPhotosOfAttempt,
} from './photos-repository.js';

const ACCEPTED_MEDIA_TYPES = ['image/jpeg', 'image/webp', 'image/png'];

const photoParamsSchema = z.object({
  clientPhotoId: z.string().regex(/^[\w-]{8,64}$/, 'Invalid photo id.'),
});

const receivePhoto = express.raw({ type: ACCEPTED_MEDIA_TYPES, limit: photoLimits.maxPhotoBytes });

export function createStudentPhotosRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router();

  async function loadPhotoAttempt(request: express.Request): Promise<AttemptRecord> {
    const attempt = await loadAttemptOfRequest(dependencies, request);
    const test = await findTestOfAttempt(database, attempt);
    if (!takesPhotoAnswers(test.writtenAnswers)) {
      throw forbidden('This test does not take photo answers.', 'photos_not_taken');
    }
    return attempt;
  }

  router.get('/', async (request, response) => {
    const attempt = await loadPhotoAttempt(request);
    response.json({
      photos: await listPhotosOfAttempt(database, attempt.id),
      photosOpenUntil: photosOpenUntil(attempt),
      serverTime: clock.now(),
    } satisfies AnswerPhotoListResponse);
  });

  router.put('/:clientPhotoId', receivePhoto, async (request, response) => {
    const attempt = await loadPhotoAttempt(request);
    const { clientPhotoId } = parseInput(photoParamsSchema, request.params);
    const known = await findPhotoByClientId(database, attempt.id, clientPhotoId);
    if (known) {
      response.json({ photo: known } satisfies SaveAnswerPhotoResponse);
      return;
    }

    const windowProblem = photoWindowProblem(attempt, clock.now());
    if (windowProblem) throw forbidden(windowProblem, 'photos_closed');
    const image = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    const metadata = await readMetadata(image);
    const fileProblem = photoFileProblem(metadata);
    if (fileProblem) throw badRequest(fileProblem, 'invalid_photo');

    const photo = await retryTransientErrors(() =>
      insertPhotoIfRoom(
        database,
        {
          attemptId: attempt.id,
          clientPhotoId,
          image,
          mediaType: `image/${metadata.format ?? 'jpeg'}`,
          width: metadata.width ?? 0,
          height: metadata.height ?? 0,
          createdAt: clock.now(),
        },
        photoLimits.maxPhotos,
      ),
    ).catch(async (error: unknown) => {
      if (!isUniqueConstraintError(error)) throw error;
      const saved = await findPhotoByClientId(database, attempt.id, clientPhotoId);
      if (saved) return saved;
      throw new HttpError(503, 'try_again', 'Please try again.');
    });
    if (!photo) {
      throw conflict(`You can add at most ${photoLimits.maxPhotos} photos.`, 'too_many_photos');
    }
    response.status(201).json({ photo } satisfies SaveAnswerPhotoResponse);
  });

  router.delete('/:clientPhotoId', async (request, response) => {
    const attempt = await loadPhotoAttempt(request);
    const { clientPhotoId } = parseInput(photoParamsSchema, request.params);
    const windowProblem = photoWindowProblem(attempt, clock.now());
    if (windowProblem) throw forbidden(windowProblem, 'photos_closed');
    await deletePhoto(database, attempt.id, clientPhotoId);
    response.status(204).end();
  });

  return router;
}

async function readMetadata(image: Buffer): Promise<PhotoMetadata> {
  if (image.length === 0) return { format: undefined, width: undefined, height: undefined };
  try {
    const { format, width, height } = await sharp(image).metadata();
    return { format, width, height };
  } catch {
    return { format: undefined, width: undefined, height: undefined };
  }
}
