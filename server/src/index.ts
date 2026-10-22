import { existsSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

// Local development reads the repo-root .env; in production the host provides env vars.
const envFile = path.resolve(import.meta.dirname, '../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const config = loadConfig();
const app = createApp({
  webDistDir: path.resolve(import.meta.dirname, '../../web/dist'),
});

const server = app.listen(config.port, (error) => {
  if (error) throw error;
  console.log(`Exam Room server listening on http://localhost:${config.port} (${config.env})`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
