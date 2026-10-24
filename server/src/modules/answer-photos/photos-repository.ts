import type { AnswerPhoto } from '@exam-room/shared';
import type { Row } from '@libsql/client';
import type { Database } from '../../database/connection.js';
import { requireFirstRow } from '../../database/query-helpers.js';

export type NewPhoto = {
  attemptId: number;
  clientPhotoId: string;
  image: Buffer;
  mediaType: string;
  width: number;
  height: number;
  createdAt: number;
};

export type StoredPhotoImage = {
  image: Buffer;
  mediaType: string;
};

const PHOTO_COLUMNS = 'photo_no, client_photo_id, width, height';

export async function listPhotosOfAttempt(
  database: Database,
  attemptId: number,
): Promise<AnswerPhoto[]> {
  const { rows } = await database.execute({
    sql: `SELECT ${PHOTO_COLUMNS} FROM answer_photos WHERE attempt_id = ? ORDER BY photo_no`,
    args: [attemptId],
  });
  return rows.map(toAnswerPhoto);
}

export async function findPhotoByClientId(
  database: Database,
  attemptId: number,
  clientPhotoId: string,
): Promise<AnswerPhoto | undefined> {
  const { rows } = await database.execute({
    sql: `SELECT ${PHOTO_COLUMNS} FROM answer_photos WHERE attempt_id = ? AND client_photo_id = ?`,
    args: [attemptId, clientPhotoId],
  });
  const [row] = rows;
  return row ? toAnswerPhoto(row) : undefined;
}

export async function insertPhotoIfRoom(
  database: Database,
  photo: NewPhoto,
  maxPhotos: number,
): Promise<AnswerPhoto | undefined> {
  const result = await database.execute({
    sql: `INSERT INTO answer_photos
            (attempt_id, photo_no, client_photo_id, image, media_type, width, height, created_at)
          SELECT ?, COALESCE(MAX(photo_no), 0) + 1, ?, ?, ?, ?, ?, ?
          FROM answer_photos WHERE attempt_id = ?
          HAVING COUNT(*) < ?
          RETURNING ${PHOTO_COLUMNS}`,
    args: [
      photo.attemptId,
      photo.clientPhotoId,
      photo.image,
      photo.mediaType,
      photo.width,
      photo.height,
      photo.createdAt,
      photo.attemptId,
      maxPhotos,
    ],
  });
  return result.rows.length > 0 ? toAnswerPhoto(requireFirstRow(result)) : undefined;
}

export async function deletePhoto(
  database: Database,
  attemptId: number,
  clientPhotoId: string,
): Promise<void> {
  await database.execute({
    sql: 'DELETE FROM answer_photos WHERE attempt_id = ? AND client_photo_id = ?',
    args: [attemptId, clientPhotoId],
  });
}

export async function findPhotoImage(
  database: Database,
  attemptId: number,
  photoNumber: number,
): Promise<StoredPhotoImage | undefined> {
  const { rows } = await database.execute({
    sql: 'SELECT image, media_type FROM answer_photos WHERE attempt_id = ? AND photo_no = ?',
    args: [attemptId, photoNumber],
  });
  const [row] = rows;
  return row
    ? { image: Buffer.from(row.image as ArrayBuffer), mediaType: String(row.media_type) }
    : undefined;
}

export async function countPhotosOfTest(
  database: Database,
  testId: number,
): Promise<Map<number, number>> {
  const { rows } = await database.execute({
    sql: `SELECT answer_photos.attempt_id, COUNT(*) AS photo_count
          FROM answer_photos
          JOIN attempts ON attempts.id = answer_photos.attempt_id
          WHERE attempts.test_id = ?
          GROUP BY answer_photos.attempt_id`,
    args: [testId],
  });
  return new Map(rows.map((row) => [Number(row.attempt_id), Number(row.photo_count)]));
}

function toAnswerPhoto(row: Row): AnswerPhoto {
  return {
    photoNumber: Number(row.photo_no),
    clientPhotoId: String(row.client_photo_id),
    width: Number(row.width),
    height: Number(row.height),
  };
}
