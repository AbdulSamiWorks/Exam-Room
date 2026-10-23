import type { NewStudent, SchoolClass, Student } from '@exam-room/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { verifyPin } from '../src/modules/students/pin.js';
import { createClass } from './support/catalog-fixtures.js';
import { logInAsTeacher, type TeacherAgent } from './support/teacher-agent.js';
import { createTestContext, type TestContext } from './support/test-context.js';

describe('students', () => {
  let context: TestContext;
  let teacher: TeacherAgent;
  let schoolClass: SchoolClass;

  beforeEach(async () => {
    context = await createTestContext();
    teacher = await logInAsTeacher(context.app);
    schoolClass = await createClass(teacher, 'Class 9');
  });
  afterEach(() => context.cleanUp());

  function addStudents(students: NewStudent[], classId = schoolClass.id) {
    return teacher.post(`/api/classes/${classId}/students`).send({ students });
  }

  async function listStudents(classId = schoolClass.id): Promise<Student[]> {
    const response = await teacher.get(`/api/classes/${classId}/students`);
    return response.body.students;
  }

  async function storedStudent(studentId: number) {
    const { rows } = await context.database.execute({
      sql: 'SELECT pin_hash, session_version FROM students WHERE id = ?',
      args: [studentId],
    });
    return { pinHash: String(rows[0]?.pin_hash), sessionVersion: Number(rows[0]?.session_version) };
  }

  it('requires a teacher login', async () => {
    const response = await request(context.app).get(`/api/classes/${schoolClass.id}/students`);
    expect(response.status).toBe(401);
  });

  it('adds students with a new 6-digit PIN each and stores only a hash of it', async () => {
    const response = await addStudents([
      { rollNumber: ' 10 ', name: '  Bilal   Ahmed ' },
      { rollNumber: '2', name: 'Ayesha Khan' },
    ]);

    expect(response.status).toBe(201);
    const [bilal, ayesha] = response.body.students;
    expect(bilal.student).toEqual({
      id: expect.any(Number),
      classId: schoolClass.id,
      name: 'Bilal Ahmed',
      rollNumber: '10',
    });
    expect(bilal.pin).toMatch(/^\d{6}$/);
    expect(ayesha.pin).toMatch(/^\d{6}$/);

    const { pinHash } = await storedStudent(bilal.student.id);
    expect(pinHash).not.toContain(bilal.pin);
    expect(await verifyPin(bilal.pin, pinHash)).toBe(true);

    expect((await listStudents()).map((student) => student.rollNumber)).toEqual(['2', '10']);
  });

  it('adds nothing when a roll number is repeated in the list', async () => {
    const response = await addStudents([
      { rollNumber: '7', name: 'Ayesha' },
      { rollNumber: '07', name: 'Bilal' },
      { rollNumber: '7', name: 'Hamza' },
    ]);

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual({
      code: 'repeated_roll_numbers',
      message: 'Roll number 7 is in the list more than once.',
    });
    expect(await listStudents()).toEqual([]);
  });

  it('adds nothing when a roll number already belongs to the class', async () => {
    await addStudents([{ rollNumber: 'A-1', name: 'Ayesha' }]);

    const response = await addStudents([
      { rollNumber: '2', name: 'Bilal' },
      { rollNumber: 'a-1', name: 'Hamza' },
    ]);

    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe('Roll number A-1 is already used in Class 9.');
    expect(await listStudents()).toHaveLength(1);
  });

  it('allows the same roll number in another class', async () => {
    const classTen = await createClass(teacher, 'Class 10');
    await addStudents([{ rollNumber: '1', name: 'Ayesha' }]);
    expect((await addStudents([{ rollNumber: '1', name: 'Bilal' }], classTen.id)).status).toBe(201);
  });

  it('edits the name, roll number and class of a student', async () => {
    const classTen = await createClass(teacher, 'Class 10');
    const [added] = (await addStudents([{ rollNumber: '1', name: 'Ayesha' }])).body.students;

    const response = await teacher
      .patch(`/api/students/${added.student.id}`)
      .send({ name: 'Ayesha Khan', rollNumber: '5', classId: classTen.id });

    expect(response.body.student).toEqual({
      id: added.student.id,
      classId: classTen.id,
      name: 'Ayesha Khan',
      rollNumber: '5',
    });
    expect(await listStudents()).toEqual([]);
    expect(await listStudents(classTen.id)).toEqual([response.body.student]);
  });

  it('refuses a roll number that another student of the class has', async () => {
    const added = (
      await addStudents([
        { rollNumber: '1', name: 'Ayesha' },
        { rollNumber: '2', name: 'Bilal' },
      ])
    ).body.students;

    const response = await teacher
      .patch(`/api/students/${added[1].student.id}`)
      .send({ rollNumber: '1' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('roll_number_taken');
  });

  it('resets a PIN and logs out the old phone', async () => {
    const [added] = (await addStudents([{ rollNumber: '1', name: 'Ayesha' }])).body.students;
    const before = await storedStudent(added.student.id);

    const response = await teacher.post(`/api/students/${added.student.id}/reset-pin`);

    expect(response.status).toBe(200);
    expect(response.body.student).toEqual(added.student);
    expect(response.body.pin).toMatch(/^\d{6}$/);
    const after = await storedStudent(added.student.id);
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
    expect(await verifyPin(response.body.pin, after.pinHash)).toBe(true);
  });

  it('moves every student to another class', async () => {
    const classTen = await createClass(teacher, 'Class 10');
    await addStudents([
      { rollNumber: '1', name: 'Ayesha' },
      { rollNumber: '2', name: 'Bilal' },
    ]);

    const response = await teacher
      .post(`/api/classes/${schoolClass.id}/students/move`)
      .send({ toClassId: classTen.id });

    expect(response.body).toEqual({ movedStudentCount: 2 });
    expect(await listStudents(classTen.id)).toHaveLength(2);
    expect((await teacher.delete(`/api/classes/${schoolClass.id}`)).status).toBe(204);
  });

  it('moves nobody when a roll number is already used in the other class', async () => {
    const classTen = await createClass(teacher, 'Class 10');
    await addStudents([
      { rollNumber: '1', name: 'Ayesha' },
      { rollNumber: '2', name: 'Bilal' },
    ]);
    await addStudents([{ rollNumber: '2', name: 'Hamza' }], classTen.id);

    const response = await teacher
      .post(`/api/classes/${schoolClass.id}/students/move`)
      .send({ toClassId: classTen.id });

    expect(response.status).toBe(409);
    expect(await listStudents()).toHaveLength(2);
  });

  it('deletes a student', async () => {
    const [added] = (await addStudents([{ rollNumber: '1', name: 'Ayesha' }])).body.students;
    expect((await teacher.delete(`/api/students/${added.student.id}`)).status).toBe(204);
    expect(await listStudents()).toEqual([]);
  });

  it('rejects bad lists and unknown ids', async () => {
    expect((await addStudents([])).status).toBe(400);
    expect((await addStudents([{ rollNumber: '1', name: ' ' }])).status).toBe(400);
    const tooMany = Array.from({ length: 101 }, (_, index) => ({
      rollNumber: String(index),
      name: 'Student',
    }));
    expect((await addStudents(tooMany)).status).toBe(400);
    expect((await addStudents([{ rollNumber: '1', name: 'A' }], 999)).status).toBe(404);
    expect((await teacher.patch('/api/students/999').send({ name: 'X' })).status).toBe(404);
    expect((await teacher.post('/api/students/999/reset-pin')).status).toBe(404);
  });
});
