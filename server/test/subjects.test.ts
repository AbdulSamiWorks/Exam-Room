import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { logInAsTeacher } from './support/teacher-agent.js';
import { createTestContext, type TestContext } from './support/test-context.js';

describe('subjects', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestContext();
  });
  afterEach(() => context.cleanUp());

  it('requires a teacher login', async () => {
    const response = await request(context.app).get('/api/subjects');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('unauthenticated');
  });

  it('creates subjects and lists them alphabetically', async () => {
    const teacher = await logInAsTeacher(context.app);

    const created = await teacher.post('/api/subjects').send({ name: '  Physics ' });
    expect(created.status).toBe(201);
    expect(created.body.subject).toEqual({ id: expect.any(Number), name: 'Physics' });

    await teacher.post('/api/subjects').send({ name: 'Chemistry' });

    const list = await teacher.get('/api/subjects');
    expect(list.body.subjects.map((subject: { name: string }) => subject.name)).toEqual([
      'Chemistry',
      'Physics',
    ]);
  });

  it('rejects a duplicate subject regardless of letter case', async () => {
    const teacher = await logInAsTeacher(context.app);
    await teacher.post('/api/subjects').send({ name: 'Math' });

    const duplicate = await teacher.post('/api/subjects').send({ name: 'MATH' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('subject_exists');
  });

  it('rejects an empty subject name', async () => {
    const teacher = await logInAsTeacher(context.app);
    const response = await teacher.post('/api/subjects').send({ name: '   ' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('invalid_input');
  });
});
