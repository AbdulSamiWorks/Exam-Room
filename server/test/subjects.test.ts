import type { SchoolClass } from '@exam-room/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createChapter, createClass, createSubject } from './support/catalog-fixtures.js';
import { publishTest } from './support/exam-fixtures.js';
import { logInAsTeacher, type TeacherAgent } from './support/teacher-agent.js';
import { createTestContext, type TestContext } from './support/test-context.js';

describe('subjects', () => {
  let context: TestContext;
  let teacher: TeacherAgent;
  let schoolClass: SchoolClass;

  beforeEach(async () => {
    context = await createTestContext();
    teacher = await logInAsTeacher(context.app);
    schoolClass = await createClass(teacher, 'Class 9');
  });
  afterEach(() => context.cleanUp());

  async function countRows(table: 'chapters' | 'subjects' | 'test_chapters' | 'tests') {
    const { rows } = await context.database.execute(`SELECT COUNT(*) AS total FROM ${table}`);
    return Number(rows[0]?.total);
  }

  it('requires a teacher login', async () => {
    const response = await request(context.app)
      .post(`/api/classes/${schoolClass.id}/subjects`)
      .send({ name: 'Physics' });
    expect(response.status).toBe(401);
  });

  it('creates a subject in a class', async () => {
    const response = await teacher
      .post(`/api/classes/${schoolClass.id}/subjects`)
      .send({ name: '  Physics ' });

    expect(response.status).toBe(201);
    expect(response.body.subject).toEqual({
      id: expect.any(Number),
      classId: schoolClass.id,
      name: 'Physics',
    });
  });

  it('allows the same subject name in two classes but not twice in one class', async () => {
    const classTen = await createClass(teacher, 'Class 10');
    await createSubject(teacher, schoolClass.id, 'Math');

    expect(
      (await teacher.post(`/api/classes/${classTen.id}/subjects`).send({ name: 'Math' })).status,
    ).toBe(201);

    const duplicate = await teacher
      .post(`/api/classes/${schoolClass.id}/subjects`)
      .send({ name: 'MATH' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('subject_exists');
  });

  it('renames a subject and moves it to another class', async () => {
    const classTen = await createClass(teacher, 'Class 10');
    const physics = await createSubject(teacher, schoolClass.id, 'Physics');

    const renamed = await teacher.patch(`/api/subjects/${physics.id}`).send({ name: 'Physics I' });
    expect(renamed.body.subject).toEqual({ ...physics, name: 'Physics I' });

    const moved = await teacher.patch(`/api/subjects/${physics.id}`).send({ classId: classTen.id });
    expect(moved.body.subject).toEqual({ id: physics.id, classId: classTen.id, name: 'Physics I' });

    const unknownClass = await teacher.patch(`/api/subjects/${physics.id}`).send({ classId: 999 });
    expect(unknownClass.body.error.code).toBe('class_not_found');
  });

  it('deletes a subject without tests together with its chapters', async () => {
    const physics = await createSubject(teacher, schoolClass.id, 'Physics');
    await createChapter(teacher, physics.id, 'Motion');

    expect((await teacher.delete(`/api/subjects/${physics.id}`)).status).toBe(204);
    expect(await countRows('subjects')).toBe(0);
    expect(await countRows('chapters')).toBe(0);
  });

  it('refuses to delete a subject that still has tests', async () => {
    const test = await publishTest(context.app);

    const response = await teacher.delete(`/api/subjects/${test.subject.id}`);

    expect(response.status).toBe(409);
    expect(response.body.error).toEqual({
      code: 'subject_has_tests',
      message: 'Physics still has 1 test. Move them to another subject or delete them first.',
    });
  });

  it('moves every test to another subject, removes their chapter tags, then deletes', async () => {
    const test = await publishTest(context.app);
    const motion = await createChapter(teacher, test.subject.id, 'Motion');
    await teacher.patch(`/api/tests/${test.id}`).send({ chapterIds: [motion.id] });
    const science = await createSubject(teacher, test.schoolClass.id, 'Science');

    const moved = await teacher
      .post(`/api/subjects/${test.subject.id}/move-tests`)
      .send({ toSubjectId: science.id });

    expect(moved.body).toEqual({ movedTestCount: 1 });
    const movedTest = await teacher.get(`/api/tests/${test.id}`);
    expect(movedTest.body.test).toMatchObject({ subject: { id: science.id }, chapters: [] });
    expect(await countRows('test_chapters')).toBe(0);
    expect((await teacher.delete(`/api/subjects/${test.subject.id}`)).status).toBe(204);
  });

  it('refuses to move tests to the same or an unknown subject', async () => {
    const physics = await createSubject(teacher, schoolClass.id, 'Physics');
    const toItself = await teacher
      .post(`/api/subjects/${physics.id}/move-tests`)
      .send({ toSubjectId: physics.id });
    expect(toItself.status).toBe(400);
    const toUnknown = await teacher
      .post(`/api/subjects/${physics.id}/move-tests`)
      .send({ toSubjectId: 999 });
    expect(toUnknown.status).toBe(400);
  });

  it('rejects an empty name, an empty change and unknown ids', async () => {
    const physics = await createSubject(teacher, schoolClass.id, 'Physics');
    expect(
      (await teacher.post(`/api/classes/${schoolClass.id}/subjects`).send({ name: ' ' })).status,
    ).toBe(400);
    expect((await teacher.patch(`/api/subjects/${physics.id}`).send({})).status).toBe(400);
    expect((await teacher.post('/api/classes/999/subjects').send({ name: 'X' })).status).toBe(404);
    expect((await teacher.delete('/api/subjects/999')).status).toBe(404);
  });
});
