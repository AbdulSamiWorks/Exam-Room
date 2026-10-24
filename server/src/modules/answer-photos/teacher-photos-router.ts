import type { AnswerPhotoListResponse } from '@exam-room/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import { notFound } from '../../lib/http-errors.js';
import { idParams, positiveId } from '../../lib/input-fields.js';
import { parseInput } from '../../lib/parse-input.js';
import { requireTeacher } from '../auth/teacher-session.js';
import type { AttemptRecord } from '../attempts/attempt-record.js';
import { findAttemptById } from '../attempts/attempts-repository.js';
import { photosOpenUntil } from './photo-rules.js';
import { findPhotoImage, listPhotosOfAttempt } from './photos-repository.js';

const attemptParamsSchema = idParams('attemptId');
const photoParamsSchema = z.object({ attemptId: positiveId, photoNumber: positiveId });

export function createTeacherPhotosRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router({ mergeParams: true });

  router.use(requireTeacher(dependencies));

  async function requireAttempt(request: Request): Promise<AttemptRecord> {
    const { attemptId } = parseInput(attemptParamsSchema, request.params);
    const attempt = await findAttemptById(database, attemptId);
    if (!attempt) throw notFound('Student attempt not found.');
    return attempt;
  }

  router.get('/', async (request, response) => {
    const attempt = await requireAttempt(request);
    response.json({
      photos: await listPhotosOfAttempt(database, attempt.id),
      photosOpenUntil: photosOpenUntil(attempt),
      serverTime: clock.now(),
    } satisfies AnswerPhotoListResponse);
  });

  router.get('/:photoNumber', async (request, response) => {
    const { attemptId, photoNumber } = parseInput(photoParamsSchema, request.params);
    const photo = await findPhotoImage(database, attemptId, photoNumber);
    if (!photo) throw notFound('Photo not found.');
    response.set({ 'Content-Type': photo.mediaType, 'Cache-Control': 'private, max-age=3600' });
    response.send(photo.image);
  });

  return router;
}
