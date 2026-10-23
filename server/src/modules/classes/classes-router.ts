import type { ClassListResponse, ClassResponse, SchoolClass } from '@exam-room/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import type { Database } from '../../database/connection.js';
import { deleteUnlessStillUsed, saveUnlessDuplicate } from '../../database/query-helpers.js';
import { conflict, notFound } from '../../lib/http-errors.js';
import { idParams, requiredName } from '../../lib/input-fields.js';
import { parseInput } from '../../lib/parse-input.js';
import { requireTeacher } from '../auth/teacher-session.js';
import { classDeletionBlocker } from './class-deletion.js';
import { classLimits } from './class-limits.js';
import { buildClassTree } from './class-tree.js';
import {
  countClassContents,
  deleteClass,
  findClassById,
  insertClass,
  readClassTreeRows,
  renameClass,
} from './classes-repository.js';

const classNameSchema = z.object({
  name: requiredName('Enter a class name.', classLimits.maxNameLength),
});

const classIdParamsSchema = idParams('classId');

const classExists = () => conflict('A class with this name already exists.', 'class_exists');

export async function requireClass(database: Database, request: Request): Promise<SchoolClass> {
  const { classId } = parseInput(classIdParamsSchema, request.params);
  const schoolClass = await findClassById(database, classId);
  if (!schoolClass) throw notFound('Class not found.', 'class_not_found');
  return schoolClass;
}

export function createClassesRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router();

  router.use(requireTeacher(dependencies));

  router.get('/', async (_request, response) => {
    const classes = buildClassTree(await readClassTreeRows(database));
    response.json({ classes } satisfies ClassListResponse);
  });

  router.post('/', async (request, response) => {
    const { name } = parseInput(classNameSchema, request.body);
    const schoolClass = await saveUnlessDuplicate(
      () => insertClass(database, name, clock.now()),
      classExists(),
    );
    response.status(201).json({ schoolClass } satisfies ClassResponse);
  });

  router.patch('/:classId', async (request, response) => {
    const schoolClass = await requireClass(database, request);
    const { name } = parseInput(classNameSchema, request.body);
    await saveUnlessDuplicate(() => renameClass(database, schoolClass.id, name), classExists());
    response.json({ schoolClass: { ...schoolClass, name } } satisfies ClassResponse);
  });

  router.delete('/:classId', async (request, response) => {
    const schoolClass = await requireClass(database, request);
    const blocker = classDeletionBlocker(
      schoolClass.name,
      await countClassContents(database, schoolClass.id),
    );
    if (blocker) throw conflict(blocker, 'class_not_empty');

    await deleteUnlessStillUsed(
      () => deleteClass(database, schoolClass.id),
      conflict(`${schoolClass.name} is not empty any more. Try again.`, 'class_not_empty'),
    );
    response.status(204).end();
  });

  return router;
}
