import type { TestSummary } from '@exam-room/shared';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { publishTest, startAttemptToken } from './support/exam-fixtures.js';
import { createBlankPageImage } from './support/page-image-fixtures.js';
import { logInAsTeacher } from './support/teacher-agent.js';
import { createTestContext, type TestContext } from './support/test-context.js';

describe('editing a test', () => {
  let context: TestContext;
  let pageImage: Buffer;

  beforeAll(async () => {
    pageImage = await createBlankPageImage();
  });

  beforeEach(async () => {
    context = await createTestContext();
  });
  afterEach(() => context.cleanUp());

  async function patchTest(test: TestSummary, changes: object) {
    const teacher = await logInAsTeacher(context.app);
    return teacher.patch(`/api/tests/${test.id}`).send(changes);
  }

  async function replacePaper(test: TestSummary, pageCount: number) {
    const teacher = await logInAsTeacher(context.app);
    const upload = teacher.put(`/api/tests/${test.id}/pages`);
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      upload.attach('pages', pageImage, { filename: `page-${pageNumber}.png` });
    }
    return upload;
  }

  async function createSubject(name: string): Promise<number> {
    const teacher = await logInAsTeacher(context.app);
    const response = await teacher.post('/api/subjects').send({ name });
    return response.body.subject.id;
  }

  it('changes every setting while no student has started', async () => {
    const test = await publishTest(context.app);
    const chemistryId = await createSubject('Chemistry');

    const response = await patchTest(test, {
      subjectId: chemistryId,
      title: '  Chapter 4 Quiz ',
      durationMinutes: 45,
      allowedExits: 0,
      leaveRule: 'finish',
    });

    expect(response.status).toBe(200);
    expect(response.body.test).toMatchObject({
      subject: { id: chemistryId, name: 'Chemistry' },
      title: 'Chapter 4 Quiz',
      durationMinutes: 45,
      allowedExits: 0,
      leaveRule: 'finish',
      code: test.code,
    });
  });

  describe('after a student has started', () => {
    let test: TestSummary;

    beforeEach(async () => {
      test = await publishTest(context.app);
      await startAttemptToken(context.app, test.code);
    });

    it('still changes the title and subject', async () => {
      const response = await patchTest(test, { title: 'Renamed' });
      expect(response.status).toBe(200);
      expect(response.body.test.title).toBe('Renamed');
    });

    it('accepts the same time limit, exits and leave rule as before', async () => {
      const response = await patchTest(test, {
        title: 'Renamed',
        durationMinutes: test.durationMinutes,
        allowedExits: test.allowedExits,
        leaveRule: test.leaveRule,
      });
      expect(response.status).toBe(200);
    });

    it.each([{ durationMinutes: 90 }, { allowedExits: 2 }, { leaveRule: 'finish' }])(
      'refuses to change %o',
      async (changes) => {
        const response = await patchTest(test, changes);
        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe('test_already_started');
      },
    );

    it('refuses to replace the paper', async () => {
      const response = await replacePaper(test, 2);
      expect(response.status).toBe(409);
      const { rows } = await context.database.execute('SELECT COUNT(*) AS total FROM test_pages');
      expect(Number(rows[0]?.total)).toBe(1);
    });
  });

  it('replaces the paper while no student has started', async () => {
    const test = await publishTest(context.app);

    const response = await replacePaper(test, 3);

    expect(response.status).toBe(200);
    expect(response.body.test.pageCount).toBe(3);
    const { rows } = await context.database.execute(
      'SELECT page_no FROM test_pages ORDER BY page_no',
    );
    expect(rows.map((row) => row.page_no)).toEqual([1, 2, 3]);
  });

  it('rejects an empty change, an unknown subject and a missing paper', async () => {
    const test = await publishTest(context.app);
    expect((await patchTest(test, {})).status).toBe(400);
    expect((await patchTest(test, { subjectId: 999 })).body.error.code).toBe('subject_not_found');
    expect((await replacePaper(test, 0)).body.error.code).toBe('pages_required');
  });

  it('requires a teacher login and an existing test', async () => {
    const test = await publishTest(context.app);
    expect((await request(context.app).patch(`/api/tests/${test.id}`)).status).toBe(401);
    const teacher = await logInAsTeacher(context.app);
    expect((await teacher.patch('/api/tests/999').send({ title: 'x' })).status).toBe(404);
  });
});
