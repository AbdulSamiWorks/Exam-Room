import { Router } from 'express';
import type { AppDependencies } from './app-dependencies.js';
import { notFound } from './lib/http-errors.js';
import { createAttemptRouter } from './modules/attempts/attempt-router.js';
import { createPublicTestsRouter } from './modules/attempts/public-tests-router.js';
import { createAuthRouter } from './modules/auth/auth-router.js';
import { createHealthRouter } from './modules/health/health-router.js';
import { createSubjectsRouter } from './modules/subjects/subjects-router.js';
import { createTestsRouter } from './modules/tests/tests-router.js';

export function createApiRouter(dependencies: AppDependencies): Router {
  const apiRouter = Router();

  apiRouter.use('/health', createHealthRouter());
  apiRouter.use('/auth', createAuthRouter(dependencies));
  apiRouter.use('/subjects', createSubjectsRouter(dependencies));
  apiRouter.use('/tests', createTestsRouter(dependencies));
  apiRouter.use('/public/tests', createPublicTestsRouter(dependencies));
  apiRouter.use('/attempt', createAttemptRouter(dependencies));

  apiRouter.use((_request, _response, next) => next(notFound()));
  return apiRouter;
}
