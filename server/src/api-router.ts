import { Router } from 'express';
import type { AppDependencies } from './app-dependencies.js';
import { notFound } from './lib/http-errors.js';
import { createAttemptRouter } from './modules/attempts/attempt-router.js';
import { createPublicTestsRouter } from './modules/attempts/public-tests-router.js';
import {
  createTeacherAttemptsRouter,
  createTestResultsRouter,
} from './modules/attempts/teacher-attempts-router.js';
import { createAuthRouter } from './modules/auth/auth-router.js';
import {
  createChaptersRouter,
  createSubjectChaptersRouter,
} from './modules/chapters/chapters-router.js';
import { createClassesRouter } from './modules/classes/classes-router.js';
import { createHealthRouter } from './modules/health/health-router.js';
import { createStudentAuthRouter } from './modules/student-auth/student-auth-router.js';
import { createStudentHomeRouter } from './modules/student-home/student-home-router.js';
import {
  createClassStudentsRouter,
  createStudentsRouter,
} from './modules/students/students-router.js';
import {
  createClassSubjectsRouter,
  createSubjectsRouter,
} from './modules/subjects/subjects-router.js';
import { createTestsRouter } from './modules/tests/tests-router.js';

export function createApiRouter(dependencies: AppDependencies): Router {
  const apiRouter = Router();

  apiRouter.use('/health', createHealthRouter());
  apiRouter.use('/auth', createAuthRouter(dependencies));
  apiRouter.use('/student-auth', createStudentAuthRouter(dependencies));
  apiRouter.use('/student', createStudentHomeRouter(dependencies));
  apiRouter.use('/classes/:classId/subjects', createClassSubjectsRouter(dependencies));
  apiRouter.use('/classes/:classId/students', createClassStudentsRouter(dependencies));
  apiRouter.use('/classes', createClassesRouter(dependencies));
  apiRouter.use('/subjects/:subjectId/chapters', createSubjectChaptersRouter(dependencies));
  apiRouter.use('/subjects', createSubjectsRouter(dependencies));
  apiRouter.use('/chapters', createChaptersRouter(dependencies));
  apiRouter.use('/students', createStudentsRouter(dependencies));
  apiRouter.use('/tests/:testId/attempts', createTestResultsRouter(dependencies));
  apiRouter.use('/tests', createTestsRouter(dependencies));
  apiRouter.use('/attempts', createTeacherAttemptsRouter(dependencies));
  apiRouter.use('/public/tests', createPublicTestsRouter(dependencies));
  apiRouter.use('/attempt', createAttemptRouter(dependencies));

  apiRouter.use((_request, _response, next) => next(notFound()));
  return apiRouter;
}
