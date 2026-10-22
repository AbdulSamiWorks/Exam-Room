import type { CreateTestFormField } from '@exam-room/shared';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { badRequest, payloadTooLarge } from '../../lib/http-errors.js';
import { testLimits } from './test-limits.js';

const PAGES_FIELD: CreateTestFormField = 'pages';
const MAX_TEXT_FIELDS = 10;
const MAX_TEXT_FIELD_BYTES = 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/webp', 'image/png', 'image/jpeg']);

const parseMultipartUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: testLimits.maxPages,
    fileSize: testLimits.maxPageImageBytes,
    fields: MAX_TEXT_FIELDS,
    fieldSize: MAX_TEXT_FIELD_BYTES,
  },
  fileFilter: (_request, file, decide) => {
    if (ACCEPTED_IMAGE_TYPES.has(file.mimetype)) return decide(null, true);
    decide(badRequest('Pages must be images.', 'invalid_page_image'));
  },
}).array(PAGES_FIELD, testLimits.maxPages);

export const receivePageImages: RequestHandler = (request, response, next) => {
  parseMultipartUpload(request, response, (error: unknown) => {
    next(error ? toUploadError(error) : undefined);
  });
};

export function uploadedPageImages(files: unknown): Buffer[] {
  if (!Array.isArray(files)) return [];
  return files.map((file: Express.Multer.File) => file.buffer);
}

function toUploadError(error: unknown): unknown {
  if (!(error instanceof multer.MulterError)) return error;

  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return payloadTooLarge('One of the pages is too large.', 'page_too_large');
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_UNEXPECTED_FILE':
      return badRequest(`A test can have at most ${testLimits.maxPages} pages.`, 'too_many_pages');
    default:
      return badRequest('The upload could not be read.', 'invalid_upload');
  }
}
