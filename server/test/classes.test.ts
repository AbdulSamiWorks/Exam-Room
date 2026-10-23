import type { ClassSummary } from '@exam-room/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createChapter, createClass, createSubject } from './support/catalog-fixtures.js';
import { publishTest } from './support/exam-fixtures.js';
import { logInAsTeacher, type TeacherAgent } from './support/teacher-agent.js';
import { createTestContext, type TestContext } from './support/test-context.js';

describe('classes', () => {
  let context: TestContext;
  let teacher: TeacherAgent;

  beforeEach(async () => {
    context = await createTestContext();
    teacher = await logInAsTeacher(context.app);
  });
  afterEach(() => context.cleanUp());

  async function listClasses(): Promise<ClassSummary[]> {
    const response = await teacher.get('/api/classes');
    expect(response.status).toBe(200);
    return response.body.classes;
  }

  it('requires a teacher login', async () => {
    expect((await request(context.app).get('/api/classes')).status).toBe(401);
    expect((await request(context.app).post('/api/classes').send({ name: 'X' })).status).toBe(401);
  });

  it('lists classes in natural order with their subjects, chapters and counts', async () => {
    const classTen = await createClass(teacher, 'Class 10');
    const classNine = await createClass(teacher, '  Class   9 ');
    const physics = await createSubject(teacher, classNine.id, 'Physics');
    await createSubject(teacher, classNine.id, 'Biology');
    await createChapter(teacher, physics.id, 'Motion');
    await createChapter(teacher, physics.id, 'Forces');
    await teacher.post(`/api/classes/${classNine.id}/students`).send({
      students: [{ rollNumber: '1', name: 'Ayesha' }],
    });

    const classes = await listClasses();

    expect(classes.map((schoolClass) => schoolClass.name)).toEqual(['Class 9', 'Class 10']);
    expect(classes[0]).toMatchObject({ id: classNine.id, studentCount: 1 });
    expect(classes[0]?.subjects.map((subject) => subject.name)).toEqual(['Biology', 'Physics']);
    expect(classes[0]?.subjects[1]?.chapters).toEqual([
      { id: expect.any(Number), name: 'Motion', position: 1, testCount: 0 },
      { id: expect.any(Number), name: 'Forces', position: 2, testCount: 0 },
    ]);
    expect(classes[1]).toEqual({
      id: classTen.id,
      name: 'Class 10',
      studentCount: 0,
      subjects: [],
    });
  });

  it('counts the tests of each subject and chapter', async () => {
    const test = await publishTest(context.app);
    const motion = await createChapter(teacher, test.subject.id, 'Motion');
    await teacher.patch(`/api/tests/${test.id}`).send({ chapterIds: [motion.id] });

    const [schoolClass] = await listClasses();

    expect(schoolClass?.subjects[0]).toMatchObject({
      testCount: 1,
      chapters: [{ name: 'Motion', testCount: 1 }],
    });
  });

  it('renames a class and refuses a name that is already used', async () => {
    const classNine = await createClass(teacher, 'Class 9');
    await createClass(teacher, 'Class 10');

    const renamed = await teacher.patch(`/api/classes/${classNine.id}`).send({ name: 'Nine A' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.schoolClass).toEqual({ id: classNine.id, name: 'Nine A' });

    const duplicate = await teacher
      .patch(`/api/classes/${classNine.id}`)
      .send({ name: 'class 10' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('class_exists');

    const duplicateNew = await teacher.post('/api/classes').send({ name: 'NINE a' });
    expect(duplicateNew.status).toBe(409);
  });

  it('deletes an empty class', async () => {
    const schoolClass = await createClass(teacher);

    expect((await teacher.delete(`/api/classes/${schoolClass.id}`)).status).toBe(204);
    expect(await listClasses()).toEqual([]);
  });

  it('refuses to delete a class that still has students or subjects, and says why', async () => {
    const schoolClass = await createClass(teacher, 'Class 9');
    await createSubject(teacher, schoolClass.id, 'Physics');
    await teacher.post(`/api/classes/${schoolClass.id}/students`).send({
      students: [
        { rollNumber: '1', name: 'Ayesha' },
        { rollNumber: '2', name: 'Bilal' },
      ],
    });

    const response = await teacher.delete(`/api/classes/${schoolClass.id}`);

    expect(response.status).toBe(409);
    expect(response.body.error).toEqual({
      code: 'class_not_empty',
      message: 'Class 9 still has 2 students and 1 subject. Move or delete them first.',
    });
    expect(await listClasses()).toHaveLength(1);
  });

  it('rejects an empty name and an unknown class', async () => {
    expect((await teacher.post('/api/classes').send({ name: '  ' })).status).toBe(400);
    expect((await teacher.patch('/api/classes/999').send({ name: 'X' })).status).toBe(404);
    expect((await teacher.delete('/api/classes/999')).status).toBe(404);
  });
});
