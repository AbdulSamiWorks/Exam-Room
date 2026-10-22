import express, { type Express } from 'express';
import helmet from 'helmet';
import { createApiRouter } from './api-router.js';
import type { AppDependencies } from './app-dependencies.js';
import { errorHandler } from './lib/error-handler.js';
import { serveWebApp } from './lib/serve-web-app.js';

const PROXIES_IN_FRONT_OF_SERVER = 1;
const JSON_BODY_LIMIT = '100kb';

export type AppOptions = {
  webAppDirectory?: string;
};

export function createApp(dependencies: AppDependencies, options: AppOptions = {}): Express {
  const app = express();

  app.set('trust proxy', PROXIES_IN_FRONT_OF_SERVER);
  app.use(helmet());
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.use('/api', createApiRouter(dependencies));

  if (options.webAppDirectory) {
    serveWebApp(app, options.webAppDirectory);
  }

  app.use(errorHandler);
  return app;
}
