import type { Express } from 'express';
import { createApp, type AppOptions } from '../../src/app.js';
import type { Config } from '../../src/config.js';
import { openDatabase, type Database } from '../../src/database/connection.js';
import { runMigrations } from '../../src/database/run-migrations.js';
import type { Clock } from '../../src/lib/clock.js';

export const IN_MEMORY_DATABASE_URL = ':memory:';
export const TEST_TEACHER_PASSWORD = 'correct-horse-battery';
export const TEST_START_TIME = Date.UTC(2026, 0, 12, 9, 0, 0);
export const TEST_PUBLIC_ORIGIN = 'http://localhost:5173';

export type FakeClock = Clock & {
  advanceBy: (milliseconds: number) => void;
};

export type TestContext = {
  app: Express;
  database: Database;
  clock: FakeClock;
  cleanUp: () => void;
};

export function createFakeClock(startTime = TEST_START_TIME): FakeClock {
  let currentTime = startTime;
  return {
    now: () => currentTime,
    advanceBy: (milliseconds) => {
      currentTime += milliseconds;
    },
  };
}

export async function createTestContext(options: AppOptions = {}): Promise<TestContext> {
  const database = openDatabase(IN_MEMORY_DATABASE_URL);
  await runMigrations(database);

  const clock = createFakeClock();
  const config: Config = {
    environment: 'test',
    port: 0,
    teacherPassword: TEST_TEACHER_PASSWORD,
    sessionSecret: 'test-session-secret-that-is-long-enough',
    publicOrigin: TEST_PUBLIC_ORIGIN,
    database: { url: IN_MEMORY_DATABASE_URL, authToken: undefined },
  };

  return {
    app: createApp({ config, database, clock }, options),
    database,
    clock,
    cleanUp: () => database.close(),
  };
}
