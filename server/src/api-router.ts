import { Router } from 'express';
import type { AppDependencies } from './app-dependencies.js';
import { notFound } from './lib/http-errors.js';
import { createAuthRouter } from './modules/auth/auth-router.js';
import { createHealthRouter } from './modules/health/health-router.js';

export function createApiRouter(dependencies: AppDependencies): Router {
  const apiRouter = Router();

  apiRouter.use('/health', createHealthRouter());
  apiRouter.use('/auth', createAuthRouter(dependencies));

  apiRouter.use((_request, _response, next) => next(notFound()));
  return apiRouter;
}
