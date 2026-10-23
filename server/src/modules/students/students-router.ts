import type {
  AddStudentsResponse,
  MoveStudentsResponse,
  NewStudent,
  Student,
  StudentListResponse,
  StudentResponse,
  StudentWithPin,
} from '@exam-room/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import type { Database } from '../../database/connection.js';
import { saveUnlessDuplicate } from '../../database/query-helpers.js';
import { pairUp } from '../../lib/collections.js';
import { badRequest, conflict, notFound } from '../../lib/http-errors.js';
import { atLeastOneChange, idParams, positiveId, requiredName } from '../../lib/input-fields.js';
import { parseInput } from '../../lib/parse-input.js';
import { requireTeacher } from '../auth/teacher-session.js';
import { findClassById } from '../classes/classes-repository.js';
import { requireClass } from '../classes/classes-router.js';
import {
  describeRepeatedRollNumbers,
  describeTakenRollNumbers,
  findRepeatedRollNumbers,
} from './new-students.js';
import { createPin, hashPin } from './pin.js';
import { studentLimits } from './student-limits.js';
import {
  deleteStudent,
  findStudentById,
  findTakenRollNumbers,
  insertStudents,
  listStudentsOfClass,
  moveStudentsOfClass,
  replacePinHash,
  saveStudent,
  type StudentToInsert,
} from './students-repository.js';

const studentFields = {
  rollNumber: requiredName('Enter the roll number.', studentLimits.maxRollNumberLength),
  name: requiredName("Enter the student's name.", studentLimits.maxNameLength),
};

const addStudentsSchema = z.object({
  students: z
    .array(z.object(studentFields))
    .min(1, 'Add at least one student.')
    .max(
      studentLimits.maxStudentsPerRequest,
      `Add at most ${studentLimits.maxStudentsPerRequest} students at a time.`,
    ),
});

const updateStudentSchema = z
  .object({
    rollNumber: studentFields.rollNumber.optional(),
    name: studentFields.name.optional(),
    classId: positiveId.optional(),
  })
  .refine(atLeastOneChange, 'Nothing to change.');

const moveStudentsSchema = z.object({ toClassId: positiveId });

const studentIdParamsSchema = idParams('studentId');

const rollNumberTaken = () =>
  conflict('This roll number is already used in the class.', 'roll_number_taken');

async function giveNewPins(
  newStudents: readonly NewStudent[],
): Promise<Array<StudentToInsert & { pin: string }>> {
  const preparedStudents: Array<StudentToInsert & { pin: string }> = [];
  for (const newStudent of newStudents) {
    const pin = createPin();
    preparedStudents.push({ ...newStudent, pin, pinHash: await hashPin(pin) });
  }
  return preparedStudents;
}

async function requireStudent(database: Database, request: Request): Promise<Student> {
  const { studentId } = parseInput(studentIdParamsSchema, request.params);
  const student = await findStudentById(database, studentId);
  if (!student) throw notFound('Student not found.', 'student_not_found');
  return student;
}

export function createClassStudentsRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router({ mergeParams: true });

  router.use(requireTeacher(dependencies));

  router.get('/', async (request, response) => {
    const schoolClass = await requireClass(database, request);
    const students = await listStudentsOfClass(database, schoolClass.id);
    response.json({ students } satisfies StudentListResponse);
  });

  router.post('/', async (request, response) => {
    const schoolClass = await requireClass(database, request);
    const { students: newStudents } = parseInput(addStudentsSchema, request.body);

    const repeatedRollNumbers = findRepeatedRollNumbers(newStudents);
    if (repeatedRollNumbers.length > 0) {
      throw badRequest(describeRepeatedRollNumbers(repeatedRollNumbers), 'repeated_roll_numbers');
    }
    const rollNumbers = newStudents.map((student) => student.rollNumber);
    const takenRollNumbers = await findTakenRollNumbers(database, schoolClass.id, rollNumbers);
    if (takenRollNumbers.length > 0) {
      throw conflict(
        describeTakenRollNumbers(takenRollNumbers, schoolClass.name),
        'roll_number_taken',
      );
    }

    const preparedStudents = await giveNewPins(newStudents);
    const insertedStudents = await saveUnlessDuplicate(
      () => insertStudents(database, schoolClass.id, preparedStudents, clock.now()),
      rollNumberTaken(),
    );
    const studentsWithPins: StudentWithPin[] = pairUp(insertedStudents, preparedStudents).map(
      ([student, { pin }]) => ({ student, pin }),
    );
    response.status(201).json({ students: studentsWithPins } satisfies AddStudentsResponse);
  });

  router.post('/move', async (request, response) => {
    const schoolClass = await requireClass(database, request);
    const { toClassId } = parseInput(moveStudentsSchema, request.body);
    const targetClass = await findClassById(database, toClassId);
    if (!targetClass || targetClass.id === schoolClass.id) {
      throw badRequest('Choose another class.', 'class_not_found');
    }

    const movedStudentCount = await saveUnlessDuplicate(
      () => moveStudentsOfClass(database, schoolClass.id, targetClass.id),
      conflict(
        `Some roll numbers of ${schoolClass.name} are already used in ${targetClass.name}. Change them first.`,
        'roll_number_taken',
      ),
    );
    response.json({ movedStudentCount } satisfies MoveStudentsResponse);
  });

  return router;
}

export function createStudentsRouter(dependencies: AppDependencies): Router {
  const { database } = dependencies;
  const router = Router();

  router.use(requireTeacher(dependencies));

  router.patch('/:studentId', async (request, response) => {
    const student = await requireStudent(database, request);
    const changes = parseInput(updateStudentSchema, request.body);
    if (changes.classId !== undefined && !(await findClassById(database, changes.classId))) {
      throw badRequest('Choose a class.', 'class_not_found');
    }

    const changedStudent: Student = {
      ...student,
      rollNumber: changes.rollNumber ?? student.rollNumber,
      name: changes.name ?? student.name,
      classId: changes.classId ?? student.classId,
    };
    await saveUnlessDuplicate(() => saveStudent(database, changedStudent), rollNumberTaken());
    response.json({ student: changedStudent } satisfies StudentResponse);
  });

  router.post('/:studentId/reset-pin', async (request, response) => {
    const student = await requireStudent(database, request);
    const pin = createPin();
    await replacePinHash(database, student.id, await hashPin(pin));
    response.json({ student, pin } satisfies StudentWithPin);
  });

  router.delete('/:studentId', async (request, response) => {
    const student = await requireStudent(database, request);
    await deleteStudent(database, student.id);
    response.status(204).end();
  });

  return router;
}
