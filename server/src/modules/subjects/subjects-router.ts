import type { MoveSubjectTestsResponse, Subject, SubjectResponse } from '@exam-room/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import type { Database } from '../../database/connection.js';
import { deleteUnlessStillUsed, saveUnlessDuplicate } from '../../database/query-helpers.js';
import { badRequest, conflict, notFound } from '../../lib/http-errors.js';
import { atLeastOneChange, idParams, positiveId, requiredName } from '../../lib/input-fields.js';
import { parseInput } from '../../lib/parse-input.js';
import { countOf } from '../../lib/text.js';
import { requireTeacher } from '../auth/teacher-session.js';
import { requireClass } from '../classes/classes-router.js';
import { findClassById } from '../classes/classes-repository.js';
import { subjectLimits } from './subject-limits.js';
import {
  countTestsOfSubject,
  deleteSubjectWithChapters,
  findSubjectById,
  insertSubject,
  moveTestsToSubject,
  saveSubject,
} from './subjects-repository.js';

const subjectName = requiredName('Enter a subject name.', subjectLimits.maxNameLength);

const createSubjectSchema = z.object({ name: subjectName });

const updateSubjectSchema = z
  .object({ name: subjectName.optional(), classId: positiveId.optional() })
  .refine(atLeastOneChange, 'Nothing to change.');

const moveTestsSchema = z.object({ toSubjectId: positiveId });

const subjectIdParamsSchema = idParams('subjectId');

const subjectExists = () =>
  conflict('This class already has a subject with this name.', 'subject_exists');

export async function requireSubject(database: Database, request: Request): Promise<Subject> {
  const { subjectId } = parseInput(subjectIdParamsSchema, request.params);
  const subject = await findSubjectById(database, subjectId);
  if (!subject) throw notFound('Subject not found.', 'subject_not_found');
  return subject;
}

export function createClassSubjectsRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router({ mergeParams: true });

  router.use(requireTeacher(dependencies));

  router.post('/', async (request, response) => {
    const schoolClass = await requireClass(database, request);
    const { name } = parseInput(createSubjectSchema, request.body);
    const subject = await saveUnlessDuplicate(
      () => insertSubject(database, { classId: schoolClass.id, name, createdAt: clock.now() }),
      subjectExists(),
    );
    response.status(201).json({ subject } satisfies SubjectResponse);
  });

  return router;
}

export function createSubjectsRouter(dependencies: AppDependencies): Router {
  const { database } = dependencies;
  const router = Router();

  router.use(requireTeacher(dependencies));

  router.patch('/:subjectId', async (request, response) => {
    const subject = await requireSubject(database, request);
    const changes = parseInput(updateSubjectSchema, request.body);
    if (changes.classId !== undefined && !(await findClassById(database, changes.classId))) {
      throw badRequest('Choose a class.', 'class_not_found');
    }

    const changedSubject: Subject = {
      ...subject,
      name: changes.name ?? subject.name,
      classId: changes.classId ?? subject.classId,
    };
    await saveUnlessDuplicate(() => saveSubject(database, changedSubject), subjectExists());
    response.json({ subject: changedSubject } satisfies SubjectResponse);
  });

  router.delete('/:subjectId', async (request, response) => {
    const subject = await requireSubject(database, request);
    const testCount = await countTestsOfSubject(database, subject.id);
    if (testCount > 0) {
      throw conflict(
        `${subject.name} still has ${countOf(testCount, 'test')}. Move them to another subject or delete them first.`,
        'subject_has_tests',
      );
    }

    await deleteUnlessStillUsed(
      () => deleteSubjectWithChapters(database, subject.id),
      conflict(`${subject.name} has new tests. Try again.`, 'subject_has_tests'),
    );
    response.status(204).end();
  });

  router.post('/:subjectId/move-tests', async (request, response) => {
    const subject = await requireSubject(database, request);
    const { toSubjectId } = parseInput(moveTestsSchema, request.body);
    if (toSubjectId === subject.id || !(await findSubjectById(database, toSubjectId))) {
      throw badRequest('Choose another subject.', 'subject_not_found');
    }

    const movedTestCount = await moveTestsToSubject(database, subject.id, toSubjectId);
    response.json({ movedTestCount } satisfies MoveSubjectTestsResponse);
  });

  return router;
}
