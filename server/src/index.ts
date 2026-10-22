import { existsSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase } from './database/connection.js';
import { runMigrations } from './database/run-migrations.js';
import { systemClock } from './lib/clock.js';
import { configureImageProcessingForSmallServers } from './lib/image-processing.js';

const projectRoot = path.resolve(import.meta.dirname, '../..');

async function startServer(): Promise<void> {
  loadLocalEnvironmentFile();
  configureImageProcessingForSmallServers();

  const config = loadConfig(process.env, {
    databaseUrl: `file:${path.join(projectRoot, 'data', 'exam-room.db')}`,
  });

  const database = openDatabase(config.database.url, config.database.authToken);
  const appliedMigrationIds = await runMigrations(database);
  if (appliedMigrationIds.length > 0) {
    console.log(`Applied database migrations: ${appliedMigrationIds.join(', ')}`);
  }

  const app = createApp(
    { config, database, clock: systemClock },
    { webAppDirectory: path.join(projectRoot, 'web', 'dist') },
  );

  const server = app.listen(config.port, (error) => {
    if (error) throw error;
    console.log(
      `Exam Room server listening on http://localhost:${config.port} (${config.environment})`,
    );
  });

  const shutDown = () => {
    server.close(() => {
      database.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutDown);
  process.on('SIGTERM', shutDown);
}

function loadLocalEnvironmentFile(): void {
  const environmentFilePath = path.join(projectRoot, '.env');
  if (existsSync(environmentFilePath)) {
    process.loadEnvFile(environmentFilePath);
  }
}

startServer().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
