import express, { type Express } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ONE_YEAR_IN_SECONDS = 31_536_000;
const HASHED_ASSETS_FOLDER = `${path.sep}assets${path.sep}`;

export function serveWebApp(app: Express, webAppDirectory: string): void {
  if (!existsSync(webAppDirectory)) return;

  const indexHtmlPath = path.join(webAppDirectory, 'index.html');

  app.use(
    express.static(webAppDirectory, {
      index: false,
      setHeaders(response, filePath) {
        if (filePath.includes(HASHED_ASSETS_FOLDER)) {
          response.setHeader('Cache-Control', `public, max-age=${ONE_YEAR_IN_SECONDS}, immutable`);
        }
      },
    }),
  );

  app.use((request, response, next) => {
    if (request.method !== 'GET') return next();
    response.setHeader('Cache-Control', 'no-cache');
    response.sendFile(indexHtmlPath);
  });
}
