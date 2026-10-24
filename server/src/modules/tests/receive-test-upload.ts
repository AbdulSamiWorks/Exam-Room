import type { CreateTestFormField } from '@exam-room/shared';
import { paperLimits } from '@exam-room/shared/paper-rules';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { badRequest, payloadTooLarge } from '../../lib/http-errors.js';
import { testLimits } from './test-limits.js';

type UploadField = Extract<CreateTestFormField, 'pages' | 'paperImages'>;

const MAX_TEXT_FIELDS = 30;
const MAX_TEXT_FIELD_BYTES = 1_000_000;
const ACCEPTED_IMAGE_TYPES = new Set(['image/webp', 'image/png', 'image/jpeg']);

const parseMultipartUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: testLimits.maxPages + paperLimits.maxPaperImages,
    fileSize: testLimits.maxPageImageBytes,
    fields: MAX_TEXT_FIELDS,
    fieldSize: MAX_TEXT_FIELD_BYTES,
  },
  fileFilter: (_request, file, decide) => {
    if (ACCEPTED_IMAGE_TYPES.has(file.mimetype)) return decide(null, true);
    decide(badRequest('Pages and pictures must be images.', 'invalid_page_image'));
  },
}).fields([
  { name: 'pages' satisfies UploadField, maxCount: testLimits.maxPages },
  { name: 'paperImages' satisfies UploadField, maxCount: paperLimits.maxPaperImages },
]);

export const receiveTestUpload: RequestHandler = (request, response, next) => {
  parseMultipartUpload(request, response, (error: unknown) => {
    next(error ? toUploadError(error) : undefined);
  });
};

export function uploadedImages(files: unknown, field: UploadField): Buffer[] {
  if (typeof files !== 'object' || files === null || !(field in files)) return [];
  const fieldFiles = (files as Record<string, Express.Multer.File[]>)[field] ?? [];
  return fieldFiles.map((file) => file.buffer);
}

function toUploadError(error: unknown): unknown {
  if (!(error instanceof multer.MulterError)) return error;

  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return payloadTooLarge('One of the pages or pictures is too large.', 'page_too_large');
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_UNEXPECTED_FILE':
      return badRequest(
        `A test can have at most ${testLimits.maxPages} pages and ${paperLimits.maxPaperImages} pictures.`,
        'too_many_pages',
      );
    case 'LIMIT_FIELD_VALUE':
      return payloadTooLarge('The paper is too long.', 'paper_too_large');
    default:
      return badRequest('The upload could not be read.', 'invalid_upload');
  }
}
