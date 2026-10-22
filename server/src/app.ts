import type { ApiErrorBody, HealthResponse } from '@exam-room/shared';
import express from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import path from 'node:path';

export type AppOptions = {
  /** Folder with the built React app. When present, it is served for every non-API route. */
  webDistDir?: string;
};

export function createApp(options: AppOptions = {}): express.Express {
  const app = express();

  // Render (and most hosts) sit behind one proxy; needed for correct client IPs.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();
  api.get('/health', (_req, res) => {
    const body: HealthResponse = { status: 'ok' };
    res.json(body);
  });
  app.use('/api', api);
  app.use('/api', (_req, res) => {
    const body: ApiErrorBody = { error: { code: 'not_found', message: 'Not found' } };
    res.status(404).json(body);
  });

  const { webDistDir } = options;
  if (webDistDir && existsSync(webDistDir)) {
    const indexHtml = path.join(webDistDir, 'index.html');
    app.use(
      express.static(webDistDir, {
        index: false,
        setHeaders(res, filePath) {
          // Vite puts content-hashed files in /assets, so they can be cached forever.
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );
    // Single-page app: every other GET returns index.html and React Router takes over.
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  return app;
}
