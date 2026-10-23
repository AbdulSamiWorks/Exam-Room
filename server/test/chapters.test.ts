import type { Subject } from '@exam-room/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createChapter, createClassWithSubject } from './support/catalog-fixtures.js';
import { publishTest } from './support/exam-fixtures.js';
import { logInAsTeacher, type TeacherAgent } from './support/teacher-agent.js';
import { createTestContext, type TestContext } from './support/test-context.js';

describe('chapters', () => {
  let context: TestContext;
  let teacher: TeacherAgent;
  let subject: Subject;

  beforeEach(async () => {
    context = await createTestContext();
    teacher = await logInAsTeacher(context.app);
    subject = await createClassWithSubject(teacher, 'Physics');
  });
  afterEach(() => context.cleanUp());

  async function chapterNamesInOrder(): Promise<string[]> {
    const response = await teacher.get('/api/classes');
    const classSubject = response.body.classes
      .flatMap((schoolClass: { subjects: Array<{ id: number }> }) => schoolClass.subjects)
      .find((candidate: { id: number }) => candidate.id === subject.id);
    return classSubject.chapters.map((chapter: { name: string }) => chapter.name);
  }

  it('requires a teacher login', async () => {
    const response = await request(context.app)
      .post(`/api/subjects/${subject.id}/chapters`)
      .send({ name: 'Motion' });
    expect(response.status).toBe(401);
  });

  it('adds chapters at the end of the subject', async () => {
    const motion = await createChapter(teacher, subject.id, ' Motion ');
    const forces = await createChapter(teacher, subject.id, 'Forces');

    expect(motion).toEqual({
      id: expect.any(Number),
      subjectId: subject.id,
      name: 'Motion',
      position: 1,
    });
    expect(forces.position).toBe(2);
  });

  it('refuses a chapter name that the subject already has', async () => {
    await createChapter(teacher, subject.id, 'Motion');
    const duplicate = await teacher
      .post(`/api/subjects/${subject.id}/chapters`)
      .send({ name: 'motion' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('chapter_exists');
  });

  it('renames a chapter', async () => {
    const motion = await createChapter(teacher, subject.id, 'Motion');
    const response = await teacher.patch(`/api/chapters/${motion.id}`).send({ name: 'Kinematics' });
    expect(response.body.chapter).toEqual({ ...motion, name: 'Kinematics' });
  });

  it('puts the chapters in a new order', async () => {
    const motion = await createChapter(teacher, subject.id, 'Motion');
    const forces = await createChapter(teacher, subject.id, 'Forces');
    const energy = await createChapter(teacher, subject.id, 'Energy');

    const response = await teacher
      .put(`/api/subjects/${subject.id}/chapters/order`)
      .send({ chapterIds: [energy.id, motion.id, forces.id] });

    expect(response.status).toBe(204);
    expect(await chapterNamesInOrder()).toEqual(['Energy', 'Motion', 'Forces']);
  });

  it('refuses an order that misses or repeats a chapter', async () => {
    const motion = await createChapter(teacher, subject.id, 'Motion');
    await createChapter(teacher, subject.id, 'Forces');

    for (const chapterIds of [[motion.id], [motion.id, motion.id]]) {
      const response = await teacher
        .put(`/api/subjects/${subject.id}/chapters/order`)
        .send({ chapterIds });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('chapters_changed');
    }
    expect(await chapterNamesInOrder()).toEqual(['Motion', 'Forces']);
  });

  it('deletes a chapter and only removes its tags from tests', async () => {
    const test = await publishTest(context.app);
    const motion = await createChapter(teacher, test.subject.id, 'Motion');
    const forces = await createChapter(teacher, test.subject.id, 'Forces');
    await teacher.patch(`/api/tests/${test.id}`).send({ chapterIds: [motion.id, forces.id] });

    expect((await teacher.delete(`/api/chapters/${motion.id}`)).status).toBe(204);

    const updatedTest = await teacher.get(`/api/tests/${test.id}`);
    expect(updatedTest.body.test.chapters).toEqual([{ id: forces.id, name: 'Forces' }]);
  });

  it('rejects an unknown subject or chapter', async () => {
    expect((await teacher.post('/api/subjects/999/chapters').send({ name: 'X' })).status).toBe(404);
    expect((await teacher.patch('/api/chapters/999').send({ name: 'X' })).status).toBe(404);
    expect((await teacher.delete('/api/chapters/999')).status).toBe(404);
  });
});
