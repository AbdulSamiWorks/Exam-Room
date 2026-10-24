import sharp from 'sharp';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { photosOpenUntil, photoFileProblem } from '../src/modules/answer-photos/photo-rules.js';
import { startAttemptToken, studentRequests } from './support/exam-fixtures.js';
import { publishTypedTest, SAMPLE_PAPER } from './support/paper-fixtures.js';
import { createTestContext, type TestContext } from './support/test-context.js';

const PAPER_WITHOUT_PICTURE = {
  ...SAMPLE_PAPER,
  sections: SAMPLE_PAPER.sections.map((section) => ({
    ...section,
    questions: section.questions.map((question) => ({ ...question, imageNumber: null })),
  })),
};

describe('photo answers', () => {
  let context: TestContext;
  let photo: Buffer;
  let token: string;
  let teacher: Awaited<ReturnType<typeof publishTypedTest>>['teacher'];
  let testId: number;

  beforeAll(async () => {
    photo = await sharp({
      create: { width: 1200, height: 1600, channels: 3, background: '#ffffff' },
    })
      .jpeg()
      .toBuffer();
  });

  beforeEach(async () => {
    context = await createTestContext();
    const published = await publishTypedTest(context.app, {
      paper: PAPER_WITHOUT_PICTURE,
      writtenAnswers: 'photos',
    });
    teacher = published.teacher;
    testId = published.test.id;
    token = await startAttemptToken(context.app, published.test.code);
  });
  afterEach(() => context.cleanUp());

  function upload(clientPhotoId: string, image = photo) {
    return request(context.app)
      .put(`/api/attempt/photos/${clientPhotoId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'image/jpeg')
      .send(image);
  }

  async function finish() {
    await studentRequests(context.app, token).post('/api/attempt/finish');
  }

  it('takes photos only after the student finishes', async () => {
    expect((await upload('photo-one-01')).status).toBe(403);
    await finish();

    const saved = await upload('photo-one-01');
    expect(saved.status).toBe(201);
    expect(saved.body.photo).toEqual({
      photoNumber: 1,
      clientPhotoId: 'photo-one-01',
      width: 1200,
      height: 1600,
    });
  });

  it('stores a repeated upload only once and keeps the bytes as they are', async () => {
    await finish();
    await upload('photo-one-01');
    const again = await upload('photo-one-01');
    expect(again.status).toBe(200);

    const list = await studentRequests(context.app, token).get('/api/attempt/photos');
    expect(list.body.photos).toHaveLength(1);
    const results = await teacher.get(`/api/tests/${testId}/attempts`);
    const attemptId = results.body.attempts[0].id;
    expect(results.body.attempts[0].photoCount).toBe(1);
    const image = await teacher.get(`/api/attempts/${attemptId}/photos/1`);
    expect(image.headers['content-type']).toBe('image/jpeg');
    expect(Buffer.compare(image.body as Buffer, photo)).toBe(0);
  });

  it('refuses files that are not photos and more than 10 photos', async () => {
    await finish();
    const notAnImage = await upload('photo-bad-01', Buffer.from('not an image'));
    expect(notAnImage.status).toBe(400);

    for (let photoIndex = 0; photoIndex < 10; photoIndex++) {
      expect((await upload(`photo-number-${photoIndex}`)).status).toBe(201);
    }
    const eleventh = await upload('photo-number-10');
    expect(eleventh.status).toBe(409);
    expect(eleventh.body.error.code).toBe('too_many_photos');
  });

  it('closes 30 minutes after the end and lets the student remove a photo before', async () => {
    await finish();
    await upload('photo-one-01');
    const removed = await studentRequests(context.app, token).get('/api/attempt/photos');
    expect(removed.body.photosOpenUntil).toBeGreaterThan(removed.body.serverTime);
    expect(
      (
        await request(context.app)
          .delete('/api/attempt/photos/photo-one-01')
          .set('Authorization', `Bearer ${token}`)
      ).status,
    ).toBe(204);

    context.clock.advanceBy(31 * 60 * 1000);
    expect((await upload('photo-late-01')).status).toBe(403);
  });
});

describe('photo rules', () => {
  it('opens the window only for finished attempts', () => {
    expect(photosOpenUntil({ status: 'in_progress', finishedAt: null })).toBeNull();
    expect(photosOpenUntil({ status: 'submitted', finishedAt: 1000 })).toBe(1000 + 30 * 60_000);
  });

  it('accepts readable photos of a sensible size', () => {
    expect(photoFileProblem({ format: 'jpeg', width: 1200, height: 1600 })).toBeUndefined();
    expect(photoFileProblem({ format: 'gif', width: 1200, height: 1600 })).toBeDefined();
    expect(photoFileProblem({ format: 'jpeg', width: 100, height: 1600 })).toBeDefined();
    expect(photoFileProblem({ format: 'jpeg', width: 5000, height: 1600 })).toBeDefined();
  });
});
