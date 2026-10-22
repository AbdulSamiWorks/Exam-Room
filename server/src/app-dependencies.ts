import type { Config } from './config.js';
import type { Database } from './database/connection.js';
import type { Clock } from './lib/clock.js';

export type AppDependencies = {
  config: Config;
  database: Database;
  clock: Clock;
};
