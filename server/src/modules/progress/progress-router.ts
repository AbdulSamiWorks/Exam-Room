import type { ProgressResponse } from '@exam-room/shared';
import { Router } from 'express';
import type { AppDependencies } from '../../app-dependencies.js';
import { notFound } from '../../lib/http-errors.js';
import { idParams } from '../../lib/input-fields.js';
import { parseInput } from '../../lib/parse-input.js';
import { requireTeacher } from '../auth/teacher-session.js';
import { requireSessionStudent } from '../student-auth/student-session.js';
import { findStudentAccount } from '../students/students-repository.js';
import { readProgress } from './progress-repository.js';

const studentIdParamsSchema = idParams('studentId');

export function createOwnProgressRouter(dependencies: AppDependencies): Router {
  const router = Router();

  router.get('/', async (request, response) => {
    const student = await requireSessionStudent(dependencies, request);
    response.json(
      (await readProgress(dependencies.database, student, true)) satisfies ProgressResponse,
    );
  });

  return router;
}

export function createStudentProgressRouter(dependencies: AppDependencies): Router {
  const router = Router({ mergeParams: true });
  router.use(requireTeacher(dependencies));

  router.get('/', async (request, response) => {
    const { studentId } = parseInput(studentIdParamsSchema, request.params);
    const account = await findStudentAccount(dependencies.database, studentId);
    if (!account) throw notFound('Student not found.');
    response.json(
      (await readProgress(
        dependencies.database,
        account.profile,
        false,
      )) satisfies ProgressResponse,
    );
  });

  return router;
}
